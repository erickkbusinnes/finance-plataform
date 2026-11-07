import { transactionFilters } from '@clara/shared';
import { money } from '@clara/shared/money';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import PDFDocument from 'pdfkit';
import type { SheetData } from 'write-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import { authenticate } from './auth.js';
import { atomic, integer } from './db.js';
import { check } from './errors.js';
import { authorize, moneyRows, ws } from './ledger.js';
import { transactionOrder, transactionSelect, transactionWhere } from './queries.js';
const kindNames: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
  refund: 'Reembolso',
  transfer: 'Transferência',
};
export async function reportRoutes(base: FastifyInstance) {
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);
  for (const format of ['pdf', 'xlsx'] as const)
    app.get(
      `/workspaces/:wid/export.${format}`,
      {
        schema: { params: ws, querystring: transactionFilters },
        config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      },
      async (req, reply) => {
        const wid = await authorize(req);
        const result = await atomic(async (c) => {
          await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
          const w = transactionWhere(wid, req.query);
          const rows = moneyRows(
            (
              await c.query(
                `${transactionSelect} WHERE ${w.sql} ORDER BY ${transactionOrder[req.query.sort]} LIMIT 10001`,
                w.values,
              )
            ).rows,
            ['amountCents'],
          );
          check(
            rows.length <= 10000,
            400,
            'Limite de 10.000 linhas. Reduza o período ou os filtros.',
          );
          const name = (await c.query('SELECT name FROM workspaces WHERE id=$1', [wid])).rows[0]
            .name;
          return { rows, name };
        });
        let income = 0n,
          expense = 0n,
          refunds = 0n;
        for (const row of result.rows) {
          if (row.kind === 'income') income += BigInt(row.amountCents);
          if (row.kind === 'expense') expense += BigInt(row.amountCents);
          if (row.kind === 'refund') refunds += BigInt(row.amountCents);
        }
        const totals = {
          income: integer(income),
          gross: integer(expense),
          refunds: integer(refunds),
          net: integer(expense - refunds),
          result: integer(income - expense + refunds),
        };
        const scope = `${result.name} · ${req.query.from} a ${req.query.to}`;
        if (format === 'xlsx') {
          const metadata: SheetData = [
            ['Clara · Relatório gerencial de caixa'],
            [scope],
            ['Valores originais em centavos inteiros de BRL. Coluna em reais é para apresentação.'],
            [
              'Resultados dos registros selecionados; transferências não compõem receita ou despesa.',
            ],
            ['Filtros', JSON.stringify(req.query)],
            ['Receitas (centavos)', totals.income],
            ['Despesas brutas (centavos)', totals.gross],
            ['Reembolsos (centavos)', totals.refunds],
            ['Despesas líquidas (centavos)', totals.net],
            ['Resultado de caixa (centavos)', totals.result],
          ];
          const data: SheetData = [
            [
              'Data',
              'Descrição',
              'Tipo',
              'Valor em centavos',
              'Valor em reais',
              'Conta',
              'Destino',
              'Categoria',
              'Tags',
            ],
            ...result.rows.map((r) => [
              r.date,
              r.description,
              kindNames[r.kind],
              { value: r.amountCents, type: Number },
              { value: r.amountCents / 100, type: Number, format: '#,##0.00' },
              r.accountName,
              r.destinationName || '',
              r.categoryName || '',
              r.tags.join(', '),
            ]),
          ];
          const buffer = await writeExcelFile([
            { sheet: 'Resumo', data: metadata },
            {
              sheet: 'Movimentacoes',
              data,
              columns: [
                { width: 14 },
                { width: 42 },
                { width: 18 },
                { width: 22 },
                { width: 20 },
                { width: 26 },
                { width: 26 },
                { width: 26 },
                { width: 32 },
              ],
            },
          ]).toBuffer();
          return reply
            .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .header('Content-Disposition', 'attachment; filename="clara-relatorio.xlsx"')
            .send(buffer);
        }
        const buffer = await new Promise<Buffer>((resolve, reject) => {
          const doc = new PDFDocument({
              size: 'A4',
              margin: 42,
              bufferPages: true,
              info: { Title: 'Clara — Relatório gerencial de caixa', Author: 'Clara' },
            }),
            chunks: Buffer[] = [];
          doc.on('data', (chunk) => chunks.push(chunk));
          doc.on('error', reject);
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.fillColor('#087f60').fontSize(27).text('clara.');
          doc.fillColor('#0f172a').fontSize(17).text('Relatório gerencial de caixa');
          doc.moveDown().fontSize(10).text(scope);
          doc.text(
            'Não é um demonstrativo contábil oficial. Somente registros e filtros selecionados.',
          );
          doc
            .moveDown()
            .text(`Receitas: ${money(totals.income)} | Despesas brutas: ${money(totals.gross)}`)
            .text(`Reembolsos: ${money(totals.refunds)} | Despesas líquidas: ${money(totals.net)}`)
            .text(`Resultado de caixa: ${money(totals.result)}`)
            .moveDown();
          doc
            .fontSize(8)
            .text('Filtros: ' + JSON.stringify(req.query))
            .moveDown();
          for (const row of result.rows) {
            if (doc.y > 710) doc.addPage();
            doc
              .font('Helvetica-Bold')
              .fontSize(10)
              .text(`${row.date} · ${kindNames[row.kind]} · ${money(row.amountCents)}`);
            doc
              .font('Helvetica')
              .fontSize(9)
              .text(row.description)
              .text(
                `${row.accountName}${row.destinationName ? ' → ' + row.destinationName : ''} | ${row.categoryName || 'Sem categoria'}${row.tags.length ? ' | ' + row.tags.join(', ') : ''}`,
              )
              .moveDown(0.7);
          }
          if (!result.rows.length) doc.text('Nenhuma movimentação corresponde aos filtros.');
          const count = doc.bufferedPageRange().count;
          for (let i = 0; i < count; i++) {
            doc.switchToPage(i);
            doc
              .fontSize(8)
              .fillColor('#536958')
              .text(`Clara · ${i + 1}/${count}`, 42, doc.page.height - 30, { lineBreak: false });
          }
          doc.end();
        });
        return reply
          .type('application/pdf')
          .header('Content-Disposition', 'attachment; filename="clara-relatorio.pdf"')
          .send(buffer);
      },
    );
}
