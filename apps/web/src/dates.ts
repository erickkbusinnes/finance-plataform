export const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(
    new Date(date + 'T12:00:00Z'),
  );
