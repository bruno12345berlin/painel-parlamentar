/** Executa tarefas com no máximo `n` simultâneas (ser educado com as APIs públicas). */
export async function emLote<T, R>(itens: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  const trabalhador = async () => {
    for (;;) {
      const i = proximo++;
      if (i >= itens.length) return;
      resultados[i] = await fn(itens[i]!, i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
  return resultados;
}
