const { createClient } = supabase;
const sb = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
let topics = [], activeTab = "all", editingId = null;

const statusText = {draft:"Rascunho",voting:"Em votação",approved:"Aprovado",rejected:"Rejeitado",archived:"Arquivado"};
const typeText = {decision:"Decisão",information:"Informação",suggestion:"Sugestão",task:"Tarefa"};

async function load(){
  if(!window.SUPABASE_URL || window.SUPABASE_URL.includes("COLE_")) {
    $("topics").innerHTML='<div class="empty"><b>Supabase ainda não configurado.</b><br>Abra o arquivo config.js e coloque a URL e a chave ANON do seu projeto.</div>';
    return;
  }
  const {data,error}=await sb.from("topics").select("*, topic_versions(*), votes(*)").order("created_at",{ascending:false});
  if(error){ $("topics").innerHTML=`<div class="empty">Erro ao carregar: ${error.message}</div>`; return; }
  topics=data||[]; fillCategories(); render();
}
function fillCategories(){
  const cats=[...new Set(topics.map(x=>x.category).filter(Boolean))].sort();
  $("categoryFilter").innerHTML='<option value="">Todas as categorias</option>'+cats.map(c=>`<option>${esc(c)}</option>`).join("");
}
function render(){
  const q=$("search").value.toLowerCase(), st=$("statusFilter").value, cat=$("categoryFilter").value;
  let list=topics.filter(t=>(!q||(t.title+" "+t.category+" "+t.statement).toLowerCase().includes(q))&&(!st||t.status===st)&&(!cat||t.category===cat));
  if(activeTab==="voting") list=list.filter(t=>t.status==="voting");
  if(activeTab==="approved") list=list.filter(t=>t.status==="approved");
  if(activeTab==="pending") list=list.filter(t=>["draft","voting","rejected"].includes(t.status));
  $("stats").innerHTML=[
    ["📜","Aprovados",topics.filter(x=>x.status==="approved").length],
    ["🗳️","Em votação",topics.filter(x=>x.status==="voting").length],
    ["⚠️","Pendências",topics.filter(x=>["draft","rejected"].includes(x.status)).length],
    ["📋","Total",topics.length]
  ].map(x=>`<div class="stat"><b>${x[2]}</b><span>${x[0]} ${x[1]}</span></div>`).join("");
  $("topics").innerHTML=list.length?list.map(card).join(""):'<div class="empty">Nenhum tópico encontrado.</div>';
}
function card(t){
  const v=t.votes||[], yes=v.filter(x=>x.vote==="yes").length,no=v.filter(x=>x.vote==="no").length;
  return `<article class="card" onclick="openTopic('${t.id}')">
    <div class="row"><div><div class="meta">${esc(t.category)} · ${typeText[t.type]||"Decisão"}</div><h3 class="title">${esc(t.title)}</h3></div><span class="badge ${t.status}">${statusText[t.status]}</span></div>
    <div class="statement">${esc(t.statement)}</div>
    ${t.type==="decision"&&t.status==="voting"?`<div class="meta">👍 ${yes} aceitam · 👎 ${no} rejeitam · ${Math.max(0,8-yes-no)} sem voto</div>`:""}
  </article>`;
}
window.openTopic=async id=>{
  const t=topics.find(x=>x.id===id); if(!t)return;
  const v=t.votes||[],yes=v.filter(x=>x.vote==="yes").length,no=v.filter(x=>x.vote==="no").length;
  const history=(t.topic_versions||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  $("viewContent").innerHTML=`<div class="dialog-inner">
    <div class="meta">${esc(t.category)} · ${typeText[t.type]}</div><h2>${esc(t.title)}</h2>
    <span class="badge ${t.status}">${statusText[t.status]}</span>
    <div class="statement">${esc(t.statement)}</div>
    ${t.type==="decision"&&t.status==="voting"?`<div class="voteRow"><button class="vote yes" onclick="vote('${t.id}','yes')">👍 Aceitar</button><button class="vote no" onclick="vote('${t.id}','no')">👎 Rejeitar</button></div><p class="meta">Resultado: ${yes} a favor · ${no} contra · ${8-yes-no} sem voto. Com 5 votos iguais, a proposta é encerrada automaticamente.</p>`:""}
    <div class="divider"></div><b>Histórico de versões</b><div class="history">${history.length?history.map(h=>`<div><b>Versão ${h.version}</b> · ${new Date(h.created_at).toLocaleString("pt-BR")}<br>${esc(h.statement)}</div>`).join(""):"Sem versões registradas."}</div>
    <div class="voteRow"><button class="secondary" onclick="editTopic('${t.id}')">✏️ Editar / nova versão</button><button class="danger" onclick="archiveTopic('${t.id}')">🗄️ Arquivar</button></div>
  </div>`;
  $("viewDialog").showModal();
};
window.vote=async(id,choice)=>{
  const name=prompt("Digite seu nome exatamente como cadastrado entre os 8 participantes:");
  if(!name)return;
  const {error}=await sb.from("votes").upsert({topic_id:id,voter_name:name.trim(),vote:choice},{onConflict:"topic_id,voter_name"});
  if(error){alert(error.message);return}
  await finalize(id); $("viewDialog").close(); await load();
};
async function finalize(id){
  const {data:v}=await sb.from("votes").select("vote").eq("topic_id",id);
  const yes=(v||[]).filter(x=>x.vote==="yes").length,no=(v||[]).filter(x=>x.vote==="no").length;
  if(yes>=5||no>=5) await sb.from("topics").update({status:yes>=5?"approved":"rejected"}).eq("id",id);
}
$("btnNew").onclick=()=>{editingId=null;$("topicForm").reset();$("dialogTitle").textContent="Novo tópico";$("topicDialog").showModal()};
$("closeDialog").onclick=()=>$("topicDialog").close();
$("closeView").onclick=()=>$("viewDialog").close();
$("topicForm").onsubmit=async e=>{
 e.preventDefault();
 const payload={title:$("title").value.trim(),category:$("category").value.trim(),type:$("topicType").value,statement:$("statement").value.trim(),priority:$("priority").value};
 let res;
 if(editingId){
   const t=topics.find(x=>x.id===editingId);
   const next=(t.topic_versions||[]).length+1;
   await sb.from("topic_versions").insert({topic_id:editingId,version:next,statement:payload.statement});
   res=await sb.from("topics").update({...payload,status:t.status==="approved"?"voting":"voting"}).eq("id",editingId);
 }else{
   res=await sb.from("topics").insert({...payload,status:payload.type==="decision"?"voting":"draft"}); 
 }
 if(res.error)alert(res.error.message);else{$("topicDialog").close();await load()}
};
window.editTopic=id=>{const t=topics.find(x=>x.id===id);if(!t)return;$("viewDialog").close();editingId=id;$("dialogTitle").textContent="Nova versão / edição";$("title").value=t.title;$("category").value=t.category;$("topicType").value=t.type;$("statement").value=t.statement;$("priority").value=t.priority||"medium";$("topicDialog").showModal()};
window.archiveTopic=async id=>{if(confirm("Arquivar este tópico?")){await sb.from("topics").update({status:"archived"}).eq("id",id);$("viewDialog").close();load()}};
["search","statusFilter","categoryFilter"].forEach(id=>$(id).addEventListener("input",render));
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeTab=b.dataset.tab;render()});
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
load();