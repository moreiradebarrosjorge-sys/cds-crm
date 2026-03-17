import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const METIERS = [
  "Gros œuvre & maçonnerie","Charpente & ossature bois","Menuiseries & agencement",
  "Façades & enduits","Carrelage & revêtements","Peinture & finitions",
  "Plomberie & sanitaires","Électricité","Toiture & étanchéité","Second œuvre complet"
];

const STATUTS = [
  { key: "prospect", label: "Prospect", color: "#5b8dee" },
  { key: "en_cours", label: "En cours", color: "#f0a500" },
  { key: "signe", label: "Signé", color: "#3ecf8e" },
  { key: "perdu", label: "Perdu", color: "#e05a4b" },
];

const STATUT_MAP = Object.fromEntries(STATUTS.map(s => [s.key, s]));
const TYPES_ACTION = ["Appel", "Email", "RDV", "Courrier", "LinkedIn", "Autre"];
const REPONSES = ["Oui", "Non", "Sans suite"];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(d) {
  if (!d) return "—";
  const [y, m, j] = d.split("-");
  return `${j}/${m}/${y}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr);
  return Math.round((target - today) / 86400000);
}

const EMPTY_FORM = {
  nom: "", entreprise: "", poste: "", tel: "", email: "",
  secteur: "", metier: "", statut: "prospect", relance: "", notes: ""
};

const EMPTY_ACTION = { date: "", type: "Appel", resume: "", reponse: "Non" };

export default function CRM() {
  const [prospects, setProspects] = useState([]);
  const [actions, setActions] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [actionForm, setActionForm] = useState(EMPTY_ACTION);
  const [actionFormOpen, setActionFormOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: pros } = await supabase.from("prospects").select("*").order("created_at", { ascending: false });
      const { data: acts } = await supabase.from("actions").select("*").order("date", { ascending: false });
      if (pros) setProspects(pros);
      if (acts) {
        const map = {};
        acts.forEach(a => {
          if (!map[a.prospect_id]) map[a.prospect_id] = [];
          map[a.prospect_id].push(a);
        });
        setActions(map);
      }
      setLoaded(true);
    })();
  }, []);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  function openNew() { setForm(EMPTY_FORM); setEditMode(false); setView("form"); }
  function openEdit(p) { setForm({ ...p }); setEditMode(true); setView("form"); }
  function openDetail(p) {
    setSelected(p);
    setActionForm(EMPTY_ACTION);
    setActionFormOpen(false);
    setEditingActionId(null);
    setView("detail");
  }

  async function submitForm() {
    if (!form.nom.trim() || !form.entreprise.trim()) { showToast("Nom et entreprise requis", "err"); return; }
    setSaving(true);
    if (editMode) {
      const { id, created_at, ...fields } = form;
      await supabase.from("prospects").update(fields).eq("id", id);
      setProspects(prev => prev.map(p => p.id === id ? { ...form } : p));
      showToast("Prospect mis à jour ✓");
    } else {
      const { data } = await supabase.from("prospects").insert([{
        nom: form.nom, entreprise: form.entreprise, poste: form.poste,
        tel: form.tel, email: form.email, secteur: form.secteur,
        metier: form.metier, statut: form.statut, relance: form.relance || null,
        notes: form.notes
      }]).select().single();
      if (data) setProspects(prev => [data, ...prev]);
      showToast("Prospect ajouté ✓");
    }
    setSaving(false);
    setView("list");
  }

  async function deleteProspect(id) {
    await supabase.from("prospects").delete().eq("id", id);
    setProspects(prev => prev.filter(p => p.id !== id));
    setView("list");
    showToast("Prospect supprimé");
  }

  async function updateStatut(id, statut) {
    await supabase.from("prospects").update({ statut }).eq("id", id);
    setProspects(prev => prev.map(p => p.id === id ? { ...p, statut } : p));
    if (selected?.id === id) setSelected(prev => ({ ...prev, statut }));
  }

  async function addAction(prospectId) {
    if (!actionForm.date || !actionForm.resume.trim()) { showToast("Date et résumé requis", "err"); return; }
    if (editingActionId) {
      await supabase.from("actions").update({
        date: actionForm.date, type: actionForm.type,
        resume: actionForm.resume, reponse: actionForm.reponse
      }).eq("id", editingActionId);
      setActions(prev => ({
        ...prev,
        [prospectId]: (prev[prospectId] || []).map(a => a.id === editingActionId ? { ...a, ...actionForm } : a)
      }));
      showToast("Action mise à jour ✓");
    } else {
      const { data } = await supabase.from("actions").insert([{
        prospect_id: prospectId, date: actionForm.date,
        type: actionForm.type, resume: actionForm.resume, reponse: actionForm.reponse
      }]).select().single();
      if (data) setActions(prev => ({ ...prev, [prospectId]: [data, ...(prev[prospectId] || [])] }));
      showToast("Action ajoutée ✓");
    }
    setActionForm(EMPTY_ACTION);
    setActionFormOpen(false);
    setEditingActionId(null);
  }

  async function deleteAction(prospectId, actionId) {
    await supabase.from("actions").delete().eq("id", actionId);
    setActions(prev => ({ ...prev, [prospectId]: (prev[prospectId] || []).filter(a => a.id !== actionId) }));
    showToast("Action supprimée");
  }

  function startEditAction(a) {
    setActionForm({ date: a.date, type: a.type, resume: a.resume, reponse: a.reponse });
    setEditingActionId(a.id);
    setActionFormOpen(true);
  }

  const filtered = prospects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.nom.toLowerCase().includes(q) || p.entreprise.toLowerCase().includes(q) || (p.metier||"").toLowerCase().includes(q);
    const matchStatut = filterStatut === "all" || p.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const counts = Object.fromEntries(STATUTS.map(s => [s.key, prospects.filter(p => p.statut === s.key).length]));
  const relancesUrgentes = prospects.filter(p => {
    const d = daysUntil(p.relance);
    return d !== null && d <= 3 && p.statut !== "signe" && p.statut !== "perdu";
  });

  if (!loaded) return (
    <div style={{ background: "#111", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#888", fontFamily: "monospace", letterSpacing: 2, fontSize: 13 }}>CHARGEMENT...</div>
    </div>
  );

  return (
    <div style={{ background: "#111", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#e8e4d8", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1a1a; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        input, select, textarea { font-family: 'DM Sans', sans-serif !important; }
        input::placeholder, textarea::placeholder { color: #444 !important; }
        .row-hover:hover { background: #1c1c1c !important; cursor: pointer; }
        .btn-sm:hover { opacity: 0.8; }
        .stat-card:hover { border-color: #c9a84c !important; }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "err" ? "#e05a4b" : "#3ecf8e", color: "#fff", padding: "10px 18px", borderRadius: 2, fontSize: 13, fontWeight: 500, letterSpacing: 0.5, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>{toast.msg}</div>
      )}

      <div style={{ borderBottom: "1px solid #222", padding: "0 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>CRM<span style={{ color: "#c9a84c" }}>BTP</span></span>
            <span style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#555", fontWeight: 500 }}>Prospects</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {saving && <span style={{ fontSize: 11, color: "#555", letterSpacing: 1 }}>Sauvegarde...</span>}
            {relancesUrgentes.length > 0 && (
              <div style={{ background: "#2a1a0e", border: "1px solid #f0a500", borderRadius: 2, padding: "5px 12px", fontSize: 11, color: "#f0a500", fontWeight: 500, letterSpacing: 0.5 }}>
                ⚠ {relancesUrgentes.length} relance{relancesUrgentes.length > 1 ? "s" : ""} urgente{relancesUrgentes.length > 1 ? "s" : ""}
              </div>
            )}
            {view !== "form" && (
              <button onClick={openNew} style={{ background: "#c9a84c", color: "#111", border: "none", padding: "9px 18px", borderRadius: 2, fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>+ Nouveau</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px" }}>

        {view === "list" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24 }}>
              {STATUTS.map(s => (
                <div key={s.key} className="stat-card" onClick={() => setFilterStatut(filterStatut === s.key ? "all" : s.key)}
                  style={{ background: "#161616", border: `1px solid ${filterStatut === s.key ? s.color : "#222"}`, borderRadius: 2, padding: "14px 16px", cursor: "pointer", transition: "border-color 0.2s" }}>
                  <div style={{ fontSize: 28, fontFamily: "'Playfair Display', serif", fontWeight: 900, color: s.color, lineHeight: 1 }}>{counts[s.key] || 0}</div>
                  <div style={{ fontSize: 11, color: "#666", letterSpacing: 1, textTransform: "uppercase", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher nom, entreprise, métier..."
                style={{ flex: 1, background: "#161616", border: "1px solid #222", color: "#e8e4d8", padding: "9px 14px", borderRadius: 2, fontSize: 13, outline: "none" }} />
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                style={{ background: "#161616", border: "1px solid #222", color: "#e8e4d8", padding: "9px 14px", borderRadius: 2, fontSize: 12, outline: "none", cursor: "pointer", appearance: "none", paddingRight: 32 }}>
                <option value="all">Tous les statuts</option>
                {STATUTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>

            <div style={{ background: "#161616", border: "1px solid #222", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr 1.5fr 1.2fr 1.2fr 80px", padding: "10px 16px", borderBottom: "1px solid #222", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", fontWeight: 500 }}>
                <span>Nom</span><span>Entreprise</span><span>Corps de métier</span><span>Statut</span><span>Relance</span><span>Créé le</span><span></span>
              </div>
              {filtered.length === 0 && (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "#444", fontSize: 13 }}>
                  {prospects.length === 0 ? "Aucun prospect — commencez par en ajouter un." : "Aucun résultat."}
                </div>
              )}
              {filtered.map((p, i) => {
                const s = STATUT_MAP[p.statut] || STATUTS[0];
                const d = daysUntil(p.relance);
                const urgent = d !== null && d <= 3;
                return (
                  <div key={p.id} className="row-hover" onClick={() => openDetail(p)}
                    style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr 1.5fr 1.2fr 1.2fr 80px", padding: "12px 16px", borderBottom: i < filtered.length - 1 ? "1px solid #1e1e1e" : "none", alignItems: "center", transition: "background 0.15s" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.nom}</div>
                      {p.poste && <div style={{ fontSize: 11, color: "#666" }}>{p.poste}</div>}
                    </div>
                    <div style={{ fontSize: 13, color: "#bbb" }}>{p.entreprise}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{p.metier || "—"}</div>
                    <div>
                      <span style={{ background: s.color + "22", color: s.color, border: `1px solid ${s.color}44`, borderRadius: 2, padding: "3px 8px", fontSize: 11, fontWeight: 500, letterSpacing: 0.5 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: urgent ? "#f0a500" : "#888", fontWeight: urgent ? 500 : 300 }}>
                      {p.relance ? (d === 0 ? "Aujourd'hui" : d < 0 ? `J+${Math.abs(d)}` : `Dans ${d}j`) : "—"}
                    </div>
                    <div style={{ fontSize: 11, color: "#555" }}>{p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR") : "—"}</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                      <button className="btn-sm" onClick={() => openEdit(p)} style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", width: 28, height: 28, borderRadius: 2, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✎</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#444", letterSpacing: 0.5 }}>{filtered.length} prospect{filtered.length > 1 ? "s" : ""}</div>
          </>
        )}

        {view === "form" && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <button onClick={() => setView("list")} style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", padding: "6px 12px", borderRadius: 2, cursor: "pointer", fontSize: 12 }}>← Retour</button>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{editMode ? "Modifier le prospect" : "Nouveau prospect"}</h2>
            </div>
            <div style={{ background: "#161616", border: "1px solid #222", borderRadius: 2, padding: 28 }}>
              <Section title="Coordonnées">
                <Row2>
                  <Field label="Prénom & Nom *" value={form.nom} onChange={v => setForm(f => ({...f, nom: v}))} placeholder="Marc Dupont" />
                  <Field label="Poste" value={form.poste} onChange={v => setForm(f => ({...f, poste: v}))} placeholder="Directeur de travaux" />
                </Row2>
                <Row2>
                  <Field label="Entreprise *" value={form.entreprise} onChange={v => setForm(f => ({...f, entreprise: v}))} placeholder="Groupe Altaïr" />
                  <Field label="Secteur" value={form.secteur} onChange={v => setForm(f => ({...f, secteur: v}))} placeholder="Promotion immobilière" />
                </Row2>
                <Row2>
                  <Field label="Téléphone" value={form.tel} onChange={v => setForm(f => ({...f, tel: v}))} placeholder="06 00 00 00 00" />
                  <Field label="Email" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} placeholder="m.dupont@..." />
                </Row2>
              </Section>
              <Section title="Dossier">
                <Row2>
                  <FieldSelect label="Corps de métier" value={form.metier} onChange={v => setForm(f => ({...f, metier: v}))} options={["", ...METIERS]} />
                  <FieldSelect label="Statut" value={form.statut} onChange={v => setForm(f => ({...f, statut: v}))} options={STATUTS.map(s => s.key)} labels={STATUTS.map(s => s.label)} />
                </Row2>
                <Field label="Date de relance" value={form.relance} onChange={v => setForm(f => ({...f, relance: v}))} type="date" />
              </Section>
              <Section title="Notes">
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Contexte, historique, points clés du dossier..."
                  style={{ width: "100%", background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#e8e4d8", padding: "10px 12px", borderRadius: 2, fontSize: 13, minHeight: 100, resize: "vertical", outline: "none", lineHeight: 1.6 }} />
              </Section>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={submitForm} style={{ background: "#c9a84c", color: "#111", border: "none", padding: "11px 24px", borderRadius: 2, fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer" }}>
                  {editMode ? "Enregistrer" : "Ajouter"}
                </button>
                <button onClick={() => setView("list")} style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", padding: "11px 18px", borderRadius: 2, fontSize: 12, cursor: "pointer" }}>Annuler</button>
                {editMode && (
                  <button onClick={() => { if(window.confirm("Supprimer ce prospect ?")) deleteProspect(form.id); }}
                    style={{ background: "none", border: "1px solid #e05a4b44", color: "#e05a4b", padding: "11px 18px", borderRadius: 2, fontSize: 12, cursor: "pointer", marginLeft: "auto" }}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {view === "detail" && selected && (() => {
          const p = prospects.find(x => x.id === selected.id) || selected;
          const s = STATUT_MAP[p.statut] || STATUTS[0];
          const d = daysUntil(p.relance);
          const pActions = actions[p.id] || [];
          return (
            <div style={{ maxWidth: 680 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <button onClick={() => setView("list")} style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", padding: "6px 12px", borderRadius: 2, cursor: "pointer", fontSize: 12 }}>← Retour</button>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, flex: 1 }}>{p.nom}</h2>
                <button onClick={() => openEdit(p)} style={{ background: "#c9a84c", color: "#111", border: "none", padding: "8px 16px", borderRadius: 2, fontSize: 12, fontWeight: 500, letterSpacing: 1, cursor: "pointer" }}>Modifier</button>
              </div>

              <div style={{ background: "#161616", border: "1px solid #222", borderRadius: 2, padding: 24, marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  <DetailItem label="Entreprise" value={p.entreprise} />
                  <DetailItem label="Poste" value={p.poste} />
                  <DetailItem label="Téléphone" value={p.tel} />
                  <DetailItem label="Email" value={p.email} />
                  <DetailItem label="Secteur" value={p.secteur} />
                  <DetailItem label="Corps de métier" value={p.metier} />
                </div>
                <div style={{ borderTop: "1px solid #222", paddingTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 8, fontWeight: 500 }}>Statut</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {STATUTS.map(st => (
                        <button key={st.key} onClick={() => updateStatut(p.id, st.key)}
                          style={{ background: p.statut === st.key ? st.color + "22" : "none", color: p.statut === st.key ? st.color : "#555", border: `1px solid ${p.statut === st.key ? st.color + "66" : "#2a2a2a"}`, borderRadius: 2, padding: "5px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", letterSpacing: 0.5, transition: "all 0.15s" }}>
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 8, fontWeight: 500 }}>Relance prévue</div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: d !== null && d <= 3 ? "#f0a500" : "#e8e4d8" }}>
                      {p.relance ? `${formatDate(p.relance)}${d !== null ? ` (${d === 0 ? "aujourd'hui" : d < 0 ? `dépassée de ${Math.abs(d)}j` : `dans ${d}j`})` : ""}` : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {p.notes && (
                <div style={{ background: "#161616", border: "1px solid #222", borderRadius: 2, padding: 20, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 10, fontWeight: 500 }}>Notes</div>
                  <div style={{ fontSize: 13.5, color: "#aaa", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{p.notes}</div>
                </div>
              )}

              <div style={{ background: "#161616", border: "1px solid #222", borderRadius: 2, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#c9a84c", fontWeight: 500 }}>Historique des actions</div>
                  {!actionFormOpen && (
                    <button onClick={() => { setActionForm(EMPTY_ACTION); setEditingActionId(null); setActionFormOpen(true); }}
                      style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", padding: "5px 12px", borderRadius: 2, fontSize: 11, cursor: "pointer", letterSpacing: 0.5 }}>
                      + Ajouter
                    </button>
                  )}
                </div>

                {actionFormOpen && (
                  <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 2, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 5, fontWeight: 500 }}>Date *</label>
                        <input type="date" value={actionForm.date} onChange={e => setActionForm(f => ({...f, date: e.target.value}))}
                          style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", color: "#e8e4d8", padding: "8px 10px", borderRadius: 2, fontSize: 12, outline: "none" }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 5, fontWeight: 500 }}>Type</label>
                        <select value={actionForm.type} onChange={e => setActionForm(f => ({...f, type: e.target.value}))}
                          style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", color: "#e8e4d8", padding: "8px 10px", borderRadius: 2, fontSize: 12, outline: "none", cursor: "pointer", appearance: "none" }}>
                          {TYPES_ACTION.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 5, fontWeight: 500 }}>Résumé *</label>
                      <textarea value={actionForm.resume} onChange={e => setActionForm(f => ({...f, resume: e.target.value}))}
                        placeholder="Ce qui a été dit, discuté, convenu..."
                        style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", color: "#e8e4d8", padding: "8px 10px", borderRadius: 2, fontSize: 12, minHeight: 64, resize: "vertical", outline: "none", lineHeight: 1.6 }} />
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 6, fontWeight: 500 }}>A répondu ?</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {REPONSES.map(r => {
                          const colors = { "Oui": "#3ecf8e", "Non": "#e05a4b", "Sans suite": "#888" };
                          const active = actionForm.reponse === r;
                          return (
                            <button key={r} onClick={() => setActionForm(f => ({...f, reponse: r}))}
                              style={{ background: active ? colors[r] + "22" : "none", color: active ? colors[r] : "#555", border: `1px solid ${active ? colors[r] + "66" : "#2a2a2a"}`, borderRadius: 2, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => addAction(p.id)}
                        style={{ background: "#c9a84c", color: "#111", border: "none", padding: "8px 18px", borderRadius: 2, fontSize: 11, fontWeight: 500, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                        {editingActionId ? "Enregistrer" : "Ajouter"}
                      </button>
                      <button onClick={() => { setActionFormOpen(false); setEditingActionId(null); setActionForm(EMPTY_ACTION); }}
                        style={{ background: "none", border: "1px solid #2a2a2a", color: "#888", padding: "8px 14px", borderRadius: 2, fontSize: 11, cursor: "pointer" }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {pActions.length > 0 ? (
                  <div style={{ border: "1px solid #222", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "90px 80px 1fr 90px 52px", padding: "8px 12px", borderBottom: "1px solid #222", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#444", fontWeight: 500 }}>
                      <span>Date</span><span>Type</span><span>Résumé</span><span>Réponse</span><span></span>
                    </div>
                    {pActions.map((a, i) => {
                      const repColors = { "Oui": "#3ecf8e", "Non": "#e05a4b", "Sans suite": "#888" };
                      return (
                        <div key={a.id} style={{ display: "grid", gridTemplateColumns: "90px 80px 1fr 90px 52px", padding: "10px 12px", borderBottom: i < pActions.length - 1 ? "1px solid #1e1e1e" : "none", alignItems: "start", fontSize: 12 }}>
                          <div style={{ color: "#888", fontWeight: 300 }}>{formatDate(a.date)}</div>
                          <div style={{ color: "#bbb" }}>{a.type}</div>
                          <div style={{ color: "#ccc", lineHeight: 1.5, paddingRight: 12, whiteSpace: "pre-wrap" }}>{a.resume}</div>
                          <div>
                            <span style={{ background: repColors[a.reponse] + "22", color: repColors[a.reponse], border: `1px solid ${repColors[a.reponse]}44`, borderRadius: 2, padding: "2px 7px", fontSize: 10, fontWeight: 500 }}>{a.reponse}</span>
                          </div>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button onClick={() => startEditAction(a)}
                              style={{ background: "none", border: "1px solid #2a2a2a", color: "#666", width: 22, height: 22, borderRadius: 2, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>✎</button>
                            <button onClick={() => { if(window.confirm("Supprimer cette action ?")) deleteAction(p.id, a.id); }}
                              style={{ background: "none", border: "1px solid #2a2a2a", color: "#666", width: 22, height: 22, borderRadius: 2, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !actionFormOpen && <div style={{ fontSize: 12, color: "#333", textAlign: "center", padding: "20px 0" }}>Aucune action enregistrée.</div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#c9a84c", fontWeight: 500, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        {title}<div style={{ flex: 1, height: 1, background: "#222" }} />
      </div>
      {children}
    </div>
  );
}

function Row2({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#e8e4d8", padding: "9px 12px", borderRadius: 2, fontSize: 13, outline: "none" }} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, labels }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", background: "#1e1e1e", border: "1px solid #2a2a2a", color: value ? "#e8e4d8" : "#444", padding: "9px 12px", borderRadius: 2, fontSize: 13, outline: "none", cursor: "pointer", appearance: "none" }}>
        {options.map((o, i) => <option key={o} value={o}>{labels ? labels[i] : o || "— Choisir —"}</option>)}
      </select>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#555", marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 14, color: value ? "#e8e4d8" : "#444" }}>{value || "—"}</div>
    </div>
  );
}
