/**
 * Catálogo de cobertura NFC-e / NF-e por UF (F3-5.1 / F3-5.3).
 * `hasAdapter` espelha o registry em NfCollectorFactory.
 */

const UF_COVERAGE = Object.freeze({
  SP: {
    code: "SP",
    label: "São Paulo",
    hasAdapter: true,
    portal: "nfce.fazenda.sp.gov.br",
    notes: "Consulta via QR ou chave.",
  },
  MG: {
    code: "MG",
    label: "Minas Gerais",
    hasAdapter: true,
    portal: "portalsped.fazenda.mg.gov.br",
    notes: "Consulta via QR ou chave.",
  },
  BA: {
    code: "BA",
    label: "Bahia",
    hasAdapter: true,
    portal: "nfe.sefaz.ba.gov.br",
    notes: "Exige QR completo (chave + CSC/hash).",
    requiresFullQr: true,
  },
  RJ: {
    code: "RJ",
    label: "Rio de Janeiro",
    hasAdapter: true,
    portal: "consultadfe.fazenda.rj.gov.br",
    notes: "Prioridade Fase 3 — portal consultaDFe.",
  },
  PR: {
    code: "PR",
    label: "Paraná",
    hasAdapter: true,
    portal: "fazenda.pr.gov.br/nfce",
    notes: "Prioridade Fase 3 — QR NFC-e 4.00.",
  },
});

function listCoverage(priorityStates = []) {
  const priority = new Set(
    (priorityStates || []).map((s) => String(s).toUpperCase()),
  );
  return Object.values(UF_COVERAGE).map((row) => ({
    ...row,
    inPriorityList: priority.has(row.code),
    /** Efetivamente usável: adapter + allowlist NF_PRIORITY_STATES */
    enabled: Boolean(row.hasAdapter && priority.has(row.code)),
  }));
}

module.exports = {
  UF_COVERAGE,
  listCoverage,
};
