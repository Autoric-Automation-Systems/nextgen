/**
 * Qual migração o Prisma registrou como falha.
 *
 * Duas saídas diferentes, dependendo de a falha ter acontecido agora ou em um deploy
 * anterior: P3018 imprime `Migration name: x`, P3009 imprime `The \`x\` migration
 * started at ... failed`. Sem esse nome não há como rodar `migrate resolve`, e o banco
 * fica permanentemente bloqueado para novos deploys.
 */
export function parseFailedMigration(output) {
  const applied = /Migration name:\s*(\S+)/.exec(output ?? "");
  if (applied) return applied[1];

  const blocked = /The `([^`]+)` migration started at/.exec(output ?? "");
  return blocked ? blocked[1] : undefined;
}

/** A falha é de permissão para criar papel — o caso do dono de banco no Neon. */
export function isRolePrivilegeFailure(output) {
  return /permission denied to create role|42501/.test(output ?? "");
}

/**
 * O Neon valida a senha ao gravar via `ALTER ROLE` e recusa as fracas com um 400 do
 * control plane. O texto não menciona senha fraca de forma óbvia ("insecure password"),
 * e o erro chega como falha genérica de SQL — por isso vale nomear.
 */
export function isWeakPasswordFailure(output) {
  return /insecure password/i.test(output ?? "");
}
