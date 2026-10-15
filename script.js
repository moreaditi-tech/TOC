const $ = id => document.getElementById(id);
const source = $("source");
let events=[], cursor=0, stack=[], timer=null, running=false, finished=false, lastResult=null;
const examples={valid:'<div>\\n  <p>Hello World</p>\\n</div>',mismatch:'<div><p>Hello</div></p>',missing:'<div><p>Hello</p>',unexpected:'</div>'};
function norm(name,mode){return mode==="html"?name.toLowerCase():name}
function tokenize(input,mode){
 const tokens=[],re=/<!--[\s\S]*?-->|<![^>]*>|<\?[^>]*?>|<[^>]+>/g,voids=new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);let m;
 while((m=re.exec(input))!==null){const raw=m[0];if(raw.startsWith("<!--")||raw.startsWith("<!")||raw.startsWith("<?"))continue;
 const close=raw.match(/^<\s*\/\s*([\w:.-]+)/),open=raw.match(/^<\s*([\w:.-]+)/);
 if(close)tokens.push({raw,name:norm(close[1],mode),type:"close"});
 else if(open){const name=norm(open[1],mode),self=/\/\s*>$/.test(raw)||(mode==="html"&&voids.has(name));tokens.push({raw,name,type:self?"self":"open"})}
 }return tokens
}
function buildEvents(){
 const mode=$("mode").value,tokens=tokenize(source.value,mode),s=[],out=[];let error=null;
 for(const t of tokens){if(error)break;
 if(t.type==="open"){s.push(t.name);out.push({token:t,op:"PUSH "+t.name,stack:[...s],status:"Processing",title:"Opening tag found — PUSH",explain:`The opening tag ${t.raw} is unmatched so far. Push “${t.name}” onto the stack.`,kind:"push"})}
 else if(t.type==="self")out.push({token:t,op:"SKIP (self-closing)",stack:[...s],status:"Processing",title:"Self-closing / void tag",explain:`${t.raw} does not need a stack entry in this nesting demo.`,kind:"self"});
 else if(!s.length){error={type:"unexpected"};out.push({token:t,op:"ERROR",stack:[...s],status:"REJECT",title:"Unexpected closing tag",explain:`${t.raw} was found while the stack is empty. There is no opening tag to close.`,kind:"error",error})}
 else if(s[s.length-1]!==t.name){error={type:"mismatch",expected:s[s.length-1]};out.push({token:t,op:"ERROR",stack:[...s],status:"REJECT",title:"Mismatched closing tag",explain:`The stack top is “${s[s.length-1]}”, so </${s[s.length-1]}> was expected, but ${t.raw} appeared.`,kind:"error",error})}
 else{s.pop();out.push({token:t,op:"POP "+t.name,stack:[...s],status:"Processing",title:"Matching closing tag — POP",explain:`${t.raw} matches the stack top “${t.name}”. Pop it from the stack.`,kind:"pop"})}
 }
 if(!error&&s.length){error={type:"unclosed",names:[...s]};out.push({token:{raw:"END OF INPUT"},op:"ERROR — unclosed tag",stack:[...s],status:"REJECT",title:"Input ended with unclosed tag(s)",explain:`Input ended while ${s.map(n=>"<"+n+">").join(", ")} remained on the stack.`,kind:"error",error})}
 else if(!error)out.push({token:{raw:"END OF INPUT"},op:"ACCEPT",stack:[],status:"ACCEPT",title:"All recognized tags are correctly nested",explain:"Every closing tag matched the most recent unmatched opening tag, and the stack is empty.",kind:"accept"});
 return {events:out,count:tokens.length}
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderStack(kind){$("stack-count").textContent=`${stack.length} ${stack.length===1?"item":"items"}`;const el=$("stack");if(!stack.length){el.className="stack-empty";el.innerHTML='<div class="empty-icon">∅</div><strong>Stack is empty</strong><small>Opening tags will appear here</small>';return}el.className="";el.innerHTML="";[...stack].reverse().forEach((n,i)=>{const d=document.createElement("div");d.className="stack-block"+(i===0?" top-block":"");d.innerHTML=`<span>${escapeHtml(n)}</span>${i===0?'<span class="top-tag-label">TOP</span>':""}`;el.appendChild(d)})}
function renderHistory(){const h=$("history");if(!cursor){h.innerHTML='<tr><td colspan="5" class="empty-row">Your simulation trace will appear here.</td></tr>';return}h.innerHTML="";events.slice(0,cursor).forEach((e,i)=>{const tr=document.createElement("tr"),status=e.status==="REJECT"?"err":e.status==="ACCEPT"?"ok":"";tr.innerHTML=`<td>${i+1}</td><td><code>${escapeHtml(e.token.raw)}</code></td><td><b>${escapeHtml(e.op)}</b></td><td>${e.stack.length?e.stack.map(escapeHtml).join(" , "):"Empty"}</td><td><span class="status-chip ${status}">${e.status}</span></td>`;h.appendChild(tr)})}
function updateStats(e){$("step-value").innerHTML=`${cursor} <em>/ ${events.length}</em>`;$("operation-value").textContent=e?e.op:"READY";$("processed-value").textContent=cursor;$("result-value").textContent=lastResult||"WAITING";$("result-value").style.color=lastResult==="ACCEPT"?"var(--green)":lastResult==="REJECT"?"var(--red)":"var(--navy)"}
function explain(e){$("current-token").textContent=e?e.token.raw:"No token yet";$("operation-icon").textContent=e?(e.kind==="push"?"↑":e.kind==="pop"?"↓":e.kind==="error"?"!":e.kind==="accept"?"✓":"↔"):"⌁";$("explanation-title").textContent=e?e.title:"Ready to simulate";$("explanation-text").textContent=e?e.explain:"Click Play simulation to process input from left to right. The stack remembers opening tags that still need to be closed."}
function stop(){if(timer)clearTimeout(timer);timer=null;running=false;$("pause").disabled=true}
function prepare(){stop();const b=buildEvents();events=b.events;cursor=0;stack=[];finished=false;lastResult=null;renderStack();renderHistory();updateStats();explain(null);$("result-banner").className="result-banner neutral";$("result-symbol").textContent="◷";$("result-title").textContent="Ready to simulate";$("result-message").textContent=`${b.count} markup tag token(s) detected. Press Play or Step Forward.`;$("play").disabled=false}
function applyNext(){if(finished||cursor>=events.length)return false;const e=events[cursor];if(e.kind==="push")stack.push(e.token.name);else if(e.kind==="pop")stack.pop();else if(e.kind==="error"){stack=[...e.stack];lastResult="REJECT"}else if(e.kind==="accept"){stack=[];lastResult="ACCEPT"}cursor++;renderStack(e.kind);renderHistory();updateStats(e);explain(e);
 const banner=$("result-banner");if(e.kind==="error"){finished=true;stop();banner.className="result-banner error";$("result-symbol").textContent="✕";$("result-title").textContent="REJECT — "+(e.error.type==="mismatch"?"MISMATCHED CLOSING TAG":e.error.type==="unexpected"?"UNEXPECTED CLOSING TAG":"UNCLOSED TAG");$("result-message").textContent=e.explain;$("play").disabled=true}
 else if(e.kind==="accept"){finished=true;stop();banner.className="result-banner success";$("result-symbol").textContent="✓";$("result-title").textContent="ACCEPT — ALL TAGS MATCHED";$("result-message").textContent="The stack is empty and no nesting mismatch was detected.";$("play").disabled=true}
 else{banner.className="result-banner neutral";$("result-symbol").textContent=e.kind==="push"?"↑":e.kind==="pop"?"↓":"↔";$("result-title").textContent=e.op;$("result-message").textContent=e.explain}updateStats(e);return true}
function schedule(){if(!running)return;timer=setTimeout(()=>{if(!running)return;const ok=applyNext();if(ok&&!finished)schedule()},Number($("speed").value))}
function play(){if(finished)return;running=true;$("play").disabled=true;$("pause").disabled=false;schedule()}
function pause(){stop();$("play").disabled=finished}
function step(){if(finished)return;stop();$("play").disabled=false;applyNext();if(!finished)$("play").disabled=false}
$("play").addEventListener("click",play);$("pause").addEventListener("click",pause);$("step").addEventListener("click",step);$("reset").addEventListener("click",prepare);$("mode").addEventListener("change",prepare);source.addEventListener("input",prepare);
document.querySelectorAll("[data-example]").forEach(b=>b.addEventListener("click",()=>{source.value=examples[b.dataset.example];prepare()}));
$("toggle-history").addEventListener("click",()=>{const wrap=$("history-wrap");wrap.hidden=!wrap.hidden;$("toggle-history").textContent=wrap.hidden?"Show history +":"Hide history −"});
prepare();