import { useState, useEffect } from "react";

// ─── Données simulées (en prod : appels Supabase) ───────────────────────────
const BIEN_MOCK = {
  id: "bien-001",
  type_bien: "appartement",
  adresse: "45 avenue du Prado",
  ville: "Marseille 13008",
  surface: 68,
  nb_pieces: 3,
  dpe_classe: "C",
  statut: "en_vente",
  prix_souhaite: 295000,
  date_mise_en_vente: "2026-04-28T00:00:00Z",
  completude_pct: 72,
  docs_valides: 13,
  docs_total: 18,
  nb_visites: 3,
  nb_offres: 0,
  estimation: {
    prix_estime: 278500,
    prix_m2_median: 4096,
    fourchette_basse: 272000,
    fourchette_haute: 306000,
    tendance: "stable",
    tension_marche: "moyen",
    fiabilite: "haute",
  },
  diagnostic: {
    score: 8,
    resume: "Appartement en très bon état avec travaux récents. Exposition sud et vue dégagée constituent de vrais atouts.",
    points_forts: ["Vue dégagée exposition sud", "Travaux récents cuisine et SDB", "Parking inclus"],
    points_vigilance: ["Absence de digicode", "Charges élevées à justifier"],
    annonce: {
      titre: "Appartement 68m² vue dégagée – Exposition sud – Parking – Avenue Prado",
      description: "Sur l'avenue du Prado dans le 8ème arrondissement, bel appartement de 68m² (loi Carrez) au 3ème étage avec ascenseur...",
    },
  },
};

const ALERTES_MOCK = [
  { doc_id: "erp", nom: "État des risques et pollutions", jours_restants: -352, niveau: "critique" },
  { doc_id: "plomb", nom: "Constat risque plomb (CREP)", jours_restants: 12, niveau: "attention" },
];

const VISITES_MOCK = [
  { id: 1, nom: "Sophie M.", date: "2026-05-12", statut: "realisee", interet: 4, feedback: "Très intéressée, attend retour banque" },
  { id: 2, nom: "Thomas & Julie B.", date: "2026-05-08", statut: "realisee", interet: 2, feedback: "Surface insuffisante" },
  { id: 3, nom: "Marc D.", date: "2026-05-01", statut: "realisee", interet: 3, feedback: "En attente de visiter d'autres biens" },
];

// ─── Couleurs & helpers ─────────────────────────────────────────────────────
const STATUT_STEPS = ["preparation", "en_vente", "visite", "offre", "compromis", "vendu"];
const STATUT_LABELS = {
  preparation: "Préparation",
  en_vente: "En vente",
  visite: "Visites",
  offre: "Offre",
  compromis: "Compromis",
  vendu: "Vendu",
};

function joursDepuis(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function fmt(n) {
  return new Intl.NumberFormat("fr-FR").format(n) + " €";
}

// ─── Composants ─────────────────────────────────────────────────────────────

function Badge({ niveau }) {
  const styles = {
    critique: { bg: "#FEE2E2", color: "#991B1B", label: "Critique" },
    attention: { bg: "#FEF3C7", color: "#92400E", label: "Attention" },
    info:      { bg: "#DBEAFE", color: "#1E40AF", label: "Info" },
  };
  const s = styles[niveau] || styles.info;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      borderRadius: 99, letterSpacing: "0.04em",
    }}>{s.label}</span>
  );
}

function ProgressRing({ pct, size = 64, stroke = 5 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px`,
          fontSize: 13, fontWeight: 700, fill: color, fontFamily: "inherit" }}>
        {pct}%
      </text>
    </svg>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{
      background: "white", borderRadius: 16, padding: "20px 24px",
      border: "1px solid #F3F4F6", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column", gap: 4,
      borderTop: `3px solid ${accent}`,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 26, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{value}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
      {sub && <span style={{ fontSize: 12, color: "#9CA3AF" }}>{sub}</span>}
    </div>
  );
}

function EtapeFunnel({ statut }) {
  const idx = STATUT_STEPS.indexOf(statut);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", rowGap: 8 }}>
      {STATUT_STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
              background: active ? "#4F46E5" : done ? "#ECFDF5" : "#F9FAFB",
              color: active ? "white" : done ? "#065F46" : "#9CA3AF",
              border: `1px solid ${active ? "#4F46E5" : done ? "#6EE7B7" : "#E5E7EB"}`,
              transition: "all 0.2s",
            }}>{STATUT_LABELS[s]}</div>
            {i < STATUT_STEPS.length - 1 && (
              <div style={{ width: 16, height: 1, background: done ? "#6EE7B7" : "#E5E7EB", margin: "0 2px" }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreGauge({ score }) {
  const color = score >= 7 ? "#10B981" : score >= 5 ? "#F59E0B" : "#EF4444";
  const label = score >= 7 ? "Bon potentiel" : score >= 5 ? "Potentiel moyen" : "À améliorer";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: `conic-gradient(${color} ${score * 36}deg, #F3F4F6 0)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%", background: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800, color,
        }}>{score}</div>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>Score sur 10</div>
      </div>
    </div>
  );
}

function InteretStars({ niveau }) {
  return (
    <span style={{ letterSpacing: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= niveau ? "#F59E0B" : "#E5E7EB", fontSize: 14 }}>★</span>
      ))}
    </span>
  );
}

// ─── Tableau de bord principal ───────────────────────────────────────────────

export default function Dashboard() {
  const [bien] = useState(BIEN_MOCK);
  const [activeTab, setActiveTab] = useState("overview");
  const [annonceExpanded, setAnnonceExpanded] = useState(false);
  const jours = joursDepuis(bien.date_mise_en_vente);
  const ecart = bien.prix_souhaite - bien.estimation.prix_estime;
  const ecartPct = Math.round((ecart / bien.estimation.prix_estime) * 100);

  const tabs = [
    { id: "overview",   label: "Vue d'ensemble" },
    { id: "docs",       label: "Documents" },
    { id: "visites",    label: "Visites" },
    { id: "annonce",    label: "Annonce" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#F8FAFC",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      color: "#111827",
    }}>
      {/* Header */}
      <div style={{
        background: "white", borderBottom: "1px solid #F3F4F6",
        padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "#4F46E5",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>🏡</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Copilote Immobilier</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Tableau de bord vendeur</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ALERTES_MOCK.length > 0 && (
            <div style={{
              background: "#FEE2E2", color: "#991B1B", borderRadius: 99,
              fontSize: 12, fontWeight: 700, padding: "4px 12px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              ⚠️ {ALERTES_MOCK.length} alerte{ALERTES_MOCK.length > 1 ? "s" : ""}
            </div>
          )}
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: "#4F46E5",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>V</div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* Bien header */}
        <div style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          borderRadius: 20, padding: "28px 32px", marginBottom: 24,
          color: "white", display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {bien.type_bien} · {bien.surface}m² · {bien.nb_pieces} pièces · DPE {bien.dpe_classe}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{bien.adresse}</div>
            <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 16 }}>{bien.ville}</div>
            <EtapeFunnel statut={bien.statut} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>En vente depuis</div>
            <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{jours}</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>jours</div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16, marginBottom: 24,
        }}>
          <StatCard icon="💰" label="Prix souhaité" value={fmt(bien.prix_souhaite)}
            sub={ecart > 0 ? `+${ecartPct}% vs marché` : `${ecartPct}% vs marché`}
            accent={ecart > 0 ? "#F59E0B" : "#10B981"} />
          <StatCard icon="📊" label="Estimation marché" value={fmt(bien.estimation.prix_estime)}
            sub={`${bien.estimation.prix_m2_median} €/m² médian`} accent="#4F46E5" />
          <StatCard icon="👁️" label="Visites réalisées" value={bien.nb_visites}
            sub="Dont 1 très intéressée" accent="#10B981" />
          <StatCard icon="📋" label="Dossier complet" value={`${bien.completude_pct}%`}
            sub={`${bien.docs_valides}/${bien.docs_total} documents`} accent="#F59E0B" />
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 12,
          padding: 4, marginBottom: 24,
        }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              background: activeTab === t.id ? "white" : "transparent",
              color: activeTab === t.id ? "#4F46E5" : "#6B7280",
              boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab : Vue d'ensemble */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Diagnostic */}
            <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Diagnostic Agent 1
              </div>
              <ScoreGauge score={bien.diagnostic.score} />
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, margin: "16px 0" }}>
                {bien.diagnostic.resume}
              </p>
              <div style={{ marginBottom: 12 }}>
                {bien.diagnostic.points_forts.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#10B981", fontSize: 14, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{p}</span>
                  </div>
                ))}
              </div>
              <div>
                {bien.diagnostic.points_vigilance.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#F59E0B", fontSize: 14, marginTop: 1 }}>⚠</span>
                    <span style={{ fontSize: 13, color: "#374151" }}>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimation */}
            <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #F3F4F6" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Estimation marché DVF
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#4F46E5", marginBottom: 4 }}>
                {fmt(bien.estimation.prix_estime)}
              </div>
              <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 20 }}>
                Fourchette : {fmt(bien.estimation.fourchette_basse)} — {fmt(bien.estimation.fourchette_haute)}
              </div>

              {/* Barre comparaison prix */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>
                  <span>{fmt(bien.estimation.fourchette_basse)}</span>
                  <span>{fmt(bien.estimation.fourchette_haute)}</span>
                </div>
                <div style={{ position: "relative", height: 8, background: "#F3F4F6", borderRadius: 99 }}>
                  <div style={{
                    position: "absolute", height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg, #10B981, #4F46E5)",
                    width: "60%", left: "10%",
                  }}/>
                  <div style={{
                    position: "absolute", width: 14, height: 14, borderRadius: "50%",
                    background: "#F59E0B", border: "2px solid white",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    top: -3,
                    left: `${((bien.prix_souhaite - bien.estimation.fourchette_basse) / (bien.estimation.fourchette_haute - bien.estimation.fourchette_basse)) * 70 + 10}%`,
                  }}/>
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6, textAlign: "center" }}>
                  🟡 Votre prix · Marché vert
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>Tendance</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                    {bien.estimation.tendance === "hausse" ? "📈 Hausse" : bien.estimation.tendance === "baisse" ? "📉 Baisse" : "➡️ Stable"}
                  </div>
                </div>
                <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>Tension</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                    {bien.estimation.tension_marche === "fort" ? "🔥 Fort" : bien.estimation.tension_marche === "moyen" ? "⚡ Moyen" : "💤 Faible"}
                  </div>
                </div>
                <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>Fiabilité</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>
                    ✓ {bien.estimation.fiabilite}
                  </div>
                </div>
              </div>
            </div>

            {/* Alertes documents */}
            {ALERTES_MOCK.length > 0 && (
              <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #FEE2E2", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  ⚠️ Alertes documents
                </div>
                {ALERTES_MOCK.map((a, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 0", borderBottom: i < ALERTES_MOCK.length - 1 ? "1px solid #F3F4F6" : "none",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{a.nom}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                        {a.jours_restants < 0 ? `Expiré depuis ${Math.abs(a.jours_restants)} jours` : `Expire dans ${a.jours_restants} jours`}
                      </div>
                    </div>
                    <Badge niveau={a.niveau} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab : Documents */}
        {activeTab === "docs" && (
          <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
              <ProgressRing pct={bien.completude_pct} size={80} stroke={6} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                  {bien.docs_valides} / {bien.docs_total} documents validés
                </div>
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                  Il manque {bien.docs_total - bien.docs_valides} documents pour compléter votre dossier
                </div>
              </div>
            </div>
            <div style={{
              padding: "14px 20px", background: "#EEF2FF", borderRadius: 12,
              fontSize: 13, color: "#4338CA", fontWeight: 500,
            }}>
              💡 Le délai de rétractation de l'acheteur ne commence à courir qu'une fois tous les documents copropriété remis. Complétez votre dossier avant la première visite.
            </div>
          </div>
        )}

        {/* Tab : Visites */}
        {activeTab === "visites" && (
          <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #F3F4F6" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {VISITES_MOCK.length} visites réalisées
            </div>
            {VISITES_MOCK.map((v, i) => (
              <div key={v.id} style={{
                padding: "16px 0",
                borderBottom: i < VISITES_MOCK.length - 1 ? "1px solid #F3F4F6" : "none",
                display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16,
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: "#EEF2FF",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: "#4F46E5", flexShrink: 0,
                  }}>{v.nom.charAt(0)}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{v.nom}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{new Date(v.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>
                    <div style={{ fontSize: 13, color: "#6B7280" }}>{v.feedback}</div>
                  </div>
                </div>
                <InteretStars niveau={v.interet} />
              </div>
            ))}
          </div>
        )}

        {/* Tab : Annonce */}
        {activeTab === "annonce" && (
          <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #F3F4F6" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7280", marginBottom: 16, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Annonce générée par l'Agent 1
            </div>
            <div style={{
              background: "#F8FAFC", borderRadius: 12, padding: 20, marginBottom: 16,
              borderLeft: "3px solid #4F46E5",
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 12 }}>
                {bien.diagnostic.annonce.titre}
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7 }}>
                {annonceExpanded
                  ? bien.diagnostic.annonce.description
                  : bien.diagnostic.annonce.description.substring(0, 180) + "..."}
              </div>
              <button onClick={() => setAnnonceExpanded(!annonceExpanded)} style={{
                background: "none", border: "none", color: "#4F46E5", fontSize: 13,
                fontWeight: 600, cursor: "pointer", padding: "8px 0 0",
              }}>{annonceExpanded ? "Voir moins ↑" : "Lire la suite ↓"}</button>
            </div>
            <button style={{
              width: "100%", padding: "12px 24px", background: "#4F46E5", color: "white",
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>📋 Copier l'annonce</button>
          </div>
        )}

      </div>
    </div>
  );
}
