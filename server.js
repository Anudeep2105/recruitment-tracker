const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'northstar.sqlite');
const COOKIE = 'northstar_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const roles = ['founder', 'admin', 'recruiter', 'finance'];
const permissions = {
  founder: ['*'], admin: ['*'],
  recruiter: ['dashboard:read','clients:read','jobs:read','jobs:write','candidates:read','candidates:write','placements:read','placements:write','recruiters:read'],
  finance: ['dashboard:read','clients:read','placements:read','invoices:read','invoices:write','reports:read']
};
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, industry TEXT DEFAULT '', contact TEXT DEFAULT '', email TEXT DEFAULT '', phone TEXT DEFAULT '', payment_days INTEGER DEFAULT 30, notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY, title TEXT NOT NULL, client_id INTEGER, recruiter_id INTEGER, status TEXT NOT NULL DEFAULT 'Open', fee_type TEXT DEFAULT 'Fixed', fee_amount REAL DEFAULT 0, openings INTEGER DEFAULT 1, priority TEXT DEFAULT 'Normal', description TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(recruiter_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS candidates (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT DEFAULT '', phone TEXT DEFAULT '', current_title TEXT DEFAULT '', skills TEXT DEFAULT '', experience REAL DEFAULT 0, location TEXT DEFAULT '', source TEXT DEFAULT '', owner_id INTEGER, notes TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL, job_id INTEGER NOT NULL, stage TEXT NOT NULL DEFAULT 'Sourced', interview_at TEXT DEFAULT '', feedback TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(candidate_id, job_id), FOREIGN KEY(candidate_id) REFERENCES candidates(id), FOREIGN KEY(job_id) REFERENCES jobs(id));
CREATE TABLE IF NOT EXISTS placements (id INTEGER PRIMARY KEY, candidate_id INTEGER NOT NULL, job_id INTEGER NOT NULL, client_id INTEGER NOT NULL, recruiter_id INTEGER, joined_on TEXT NOT NULL, fee REAL NOT NULL DEFAULT 0, payment_days INTEGER NOT NULL DEFAULT 30, invoice_id INTEGER, replacement_days INTEGER NOT NULL DEFAULT 90, replacement_until TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'Joined', notes TEXT DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(candidate_id) REFERENCES candidates(id), FOREIGN KEY(job_id) REFERENCES jobs(id), FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(recruiter_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY, number TEXT UNIQUE NOT NULL, client_id INTEGER NOT NULL, placement_id INTEGER, issue_date TEXT NOT NULL, due_date TEXT NOT NULL, amount REAL NOT NULL, paid_amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Sent', notes TEXT DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(placement_id) REFERENCES placements(id));
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL, amount REAL NOT NULL, received_on TEXT NOT NULL, method TEXT DEFAULT '', reference TEXT DEFAULT '', notes TEXT DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(invoice_id) REFERENCES invoices(id));
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, detail TEXT DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email) WHERE email <> ''; CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id); CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);`);

const now = () => new Date().toISOString();
const dateToday = () => new Date().toISOString().slice(0, 10);
const sessions = new Map();
function safeEqual(a, b) { const aa=Buffer.from(a),bb=Buffer.from(b); return aa.length===bb.length && crypto.timingSafeEqual(aa,bb); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { const key=crypto.scryptSync(password, salt, 64); return `${salt}:${key.toString('hex')}`; }
function verifyPassword(password, stored) { const [salt,key]=String(stored).split(':'); try { return safeEqual(crypto.scryptSync(password,salt,64).toString('hex'),key); } catch { return false; } }
function userPublic(u) { return {id:u.id,name:u.name,email:u.email,role:u.role}; }
function initAdmin() {
  if (db.prepare('SELECT count(*) n FROM users').get().n) return;
  const email=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(), password=process.env.ADMIN_PASSWORD||'';
  if (!email || password.length < 12) { console.error('First run setup required. Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) and restart.'); process.exit(1); }
  db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)').run(process.env.ADMIN_NAME||'Workspace Founder',email,hashPassword(password),'founder',now());
  console.log(`Founder account created for ${email}`);
}
initAdmin();
function getSession(req) {
  const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
  if (!cookie) return null;
  const token=cookie.slice(COOKIE.length+1), s=sessions.get(token);
  if (!s || s.expires<Date.now()) { sessions.delete(token); return null; }
  s.expires=Date.now()+SESSION_MS;
  return {token,user:db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(s.userId)};
}
function can(user, permission) { return !!user && (permissions[user.role]?.includes('*') || permissions[user.role]?.includes(permission)); }
function send(res, status, body, headers={}) { const data=typeof body==='string'?body:JSON.stringify(body); res.writeHead(status,{'Content-Type':typeof body==='string'?'text/html; charset=utf-8':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'no-store',...headers});res.end(data); }
function json(res,status,obj,headers){send(res,status,obj,headers)}
function fail(res,status,message){json(res,status,{error:message})}
function parseBody(req) { return new Promise((resolve,reject)=>{let s='',size=0;req.on('data',c=>{size+=c.length;if(size>1e6){reject(new Error('Request too large'));req.destroy()}else s+=c});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(new Error('Invalid JSON'))}});req.on('error',reject)}) }
function recordActivity(user,action,entity,id,detail=''){db.prepare('INSERT INTO activity(user_id,action,entity,entity_id,detail,created_at) VALUES(?,?,?,?,?,?)').run(user.id,action,entity,id,detail,now())}
const definitions={
 clients:{table:'clients',required:['name'],fields:['name','industry','contact','email','phone','payment_days','notes'],perm:'clients'},
 jobs:{table:'jobs',required:['title'],fields:['title','client_id','recruiter_id','status','fee_type','fee_amount','openings','priority','description'],perm:'jobs'},
 candidates:{table:'candidates',required:['name'],fields:['name','email','phone','current_title','skills','experience','location','source','owner_id','notes'],perm:'candidates'},
 applications:{table:'applications',required:['candidate_id','job_id'],fields:['candidate_id','job_id','stage','interview_at','feedback'],perm:'candidates'},
 placements:{table:'placements',required:['candidate_id','job_id','client_id','joined_on','fee'],fields:['candidate_id','job_id','client_id','recruiter_id','joined_on','fee','payment_days','replacement_days','replacement_until','status','notes'],perm:'placements'},
 invoices:{table:'invoices',required:['client_id','issue_date','amount'],fields:['number','client_id','placement_id','issue_date','due_date','amount','paid_amount','status','notes'],perm:'invoices'}
};
function asNumber(v,key){if(['id','_id'].includes(key)||key.endsWith('_id')||['payment_days','replacement_days','openings','experience'].includes(key))return v===''||v==null?null:Number(v);if(['fee','fee_amount','amount','paid_amount'].includes(key))return v===''||v==null?0:Number(v);return v}
function enriched(resource, rows){ if(resource==='invoices')return rows.map(r=>({...r,remaining:Math.max(0,r.amount-r.paid_amount),aging_days:Math.max(0,Math.floor((Date.now()-new Date(r.due_date+'T00:00:00Z'))/86400000)),status:r.status!=='Paid'&&r.paid_amount<r.amount&&r.due_date<dateToday()?'Overdue':r.status})); return rows; }
function list(resource) {
 const sql={clients:'SELECT * FROM clients ORDER BY name',jobs:'SELECT j.*,c.name client_name,u.name recruiter_name,(SELECT count(*) FROM applications a WHERE a.job_id=j.id) candidate_count FROM jobs j LEFT JOIN clients c ON c.id=j.client_id LEFT JOIN users u ON u.id=j.recruiter_id ORDER BY j.created_at DESC',candidates:'SELECT c.*,u.name owner_name FROM candidates c LEFT JOIN users u ON u.id=c.owner_id ORDER BY c.created_at DESC',applications:'SELECT a.*,c.name candidate_name,c.email candidate_email,j.title job_title,cl.name client_name,u.name recruiter_name FROM applications a JOIN candidates c ON c.id=a.candidate_id JOIN jobs j ON j.id=a.job_id LEFT JOIN clients cl ON cl.id=j.client_id LEFT JOIN users u ON u.id=j.recruiter_id ORDER BY a.updated_at DESC',placements:'SELECT p.*,c.name candidate_name,j.title job_title,cl.name client_name,u.name recruiter_name FROM placements p JOIN candidates c ON c.id=p.candidate_id JOIN jobs j ON j.id=p.job_id JOIN clients cl ON cl.id=p.client_id LEFT JOIN users u ON u.id=p.recruiter_id ORDER BY p.created_at DESC',invoices:'SELECT i.*,c.name client_name FROM invoices i JOIN clients c ON c.id=i.client_id ORDER BY i.due_date',users:'SELECT id,name,email,role,active,created_at FROM users ORDER BY name',payments:'SELECT p.*,i.number invoice_number,c.name client_name FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN clients c ON c.id=i.client_id ORDER BY p.received_on DESC',activity:'SELECT a.*,u.name user_name FROM activity a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 30'}[resource];return sql?enriched(resource,db.prepare(sql).all()):null;
}
function dashboard() {
  const scalar=s=>db.prepare(s).get().n; const outstanding=db.prepare("SELECT COALESCE(sum(amount-paid_amount),0) n FROM invoices WHERE status!='Paid'").get().n;
 const overdue=db.prepare("SELECT COALESCE(sum(amount-paid_amount),0) n FROM invoices WHERE status!='Paid' AND due_date<?").get(dateToday()).n;
 const month=dateToday().slice(0,7);
 const revenue=db.prepare('SELECT COALESCE(sum(amount),0) n FROM invoices WHERE substr(issue_date,1,7)=?').get(month).n;
 const expected=db.prepare("SELECT COALESCE(sum(CASE WHEN fee_type='Fixed' THEN fee_amount*openings ELSE 0 END),0) n FROM jobs WHERE status='Open'").get().n;
 const hired=scalar("SELECT count(*) n FROM placements WHERE joined_on>=date('now','start of month')");
 const open=scalar("SELECT count(*) n FROM jobs WHERE status='Open'"), candidates=scalar('SELECT count(*) n FROM candidates');
 const pipeline=db.prepare("SELECT a.stage,count(*) count FROM applications a GROUP BY a.stage").all();
 const clients=db.prepare("SELECT c.id,c.name,COALESCE(sum(i.amount),0) revenue,COALESCE(sum(i.amount-i.paid_amount),0) outstanding FROM clients c LEFT JOIN invoices i ON i.client_id=c.id GROUP BY c.id ORDER BY revenue DESC LIMIT 6").all();
 const recruiterPerformance=db.prepare("SELECT u.id,u.name,count(DISTINCT p.id) placements,COALESCE(sum(p.fee),0) revenue FROM users u LEFT JOIN placements p ON p.recruiter_id=u.id WHERE u.role IN ('founder','admin','recruiter') AND u.active=1 GROUP BY u.id ORDER BY revenue DESC").all();
 const cash=db.prepare("SELECT due_date,sum(amount-paid_amount) amount FROM invoices WHERE status!='Paid' AND due_date>=? GROUP BY due_date ORDER BY due_date LIMIT 12").all(dateToday());
 return {metrics:{open_jobs:open,candidates,placements_this_month:hired,invoiced_this_month:revenue,outstanding,overdue,expected_revenue:expected},pipeline,clients,recruiters:recruiterPerformance,cash,invoices:list('invoices').slice(0,8),activity:list('activity').slice(0,8)};
}
function insertRecord(resource, data, user) {
 const d=definitions[resource]; if(!d)throw new Error('Unknown record type');
 for(const k of d.required) if(data[k]===undefined||data[k]===null||String(data[k]).trim()==='')throw new Error(`${k} is required`);
 const clean={};for(const k of d.fields) if(data[k]!==undefined)clean[k]=asNumber(data[k],k);
 if(resource==='applications'){const existing=db.prepare('SELECT id FROM applications WHERE candidate_id=? AND job_id=?').get(clean.candidate_id,clean.job_id);if(existing)throw new Error('This candidate is already linked to that job');}
 if(resource==='invoices'&&!clean.number)clean.number='NS-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-6);
 if(resource==='invoices'&&!clean.due_date){const client=db.prepare('SELECT payment_days FROM clients WHERE id=?').get(clean.client_id);if(!client)throw new Error('Choose a valid client');const issued=new Date((clean.issue_date||dateToday())+'T00:00:00Z');issued.setUTCDate(issued.getUTCDate()+Number(client.payment_days||30));clean.due_date=issued.toISOString().slice(0,10)}
 if(resource==='invoices'){clean.paid_amount=clean.paid_amount||0;clean.status=clean.paid_amount>=clean.amount?'Paid':(clean.status||'Sent')}
 const timestamp=now(); clean.created_at=timestamp;clean.updated_at=timestamp;
 const columns=Object.keys(clean), values=columns.map(k=>clean[k]);
 const result=db.prepare(`INSERT INTO ${d.table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...values);
 recordActivity(user,'created',resource,Number(result.lastInsertRowid));return Number(result.lastInsertRowid);
}
function updateRecord(resource,id,data,user){const d=definitions[resource];if(!d)throw new Error('Unknown record type');const clean={};for(const k of d.fields)if(data[k]!==undefined)clean[k]=asNumber(data[k],k);if(!Object.keys(clean).length)throw new Error('No editable fields supplied');clean.updated_at=now();const cols=Object.keys(clean);const result=db.prepare(`UPDATE ${d.table} SET ${cols.map(k=>k+'=?').join(',')} WHERE id=?`).run(...cols.map(k=>clean[k]),id);if(!result.changes)throw new Error('Record not found');recordActivity(user,'updated',resource,id);return true}
async function route(req,res){
 const url=new URL(req.url,`http://${req.headers.host||'localhost'}`), parts=url.pathname.split('/').filter(Boolean), method=req.method;
 if(method==='GET'&&url.pathname==='/'){return send(res,200,fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8'))}
 if(method==='GET'&&url.pathname==='/health')return json(res,200,{status:'ok'});
 if(method==='POST'&&url.pathname==='/api/login'){
  const b=await parseBody(req),u=db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(String(b.email||'').trim().toLowerCase());
  if(!u||!verifyPassword(String(b.password||''),u.password_hash))return fail(res,401,'Email or password is incorrect');
  const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{userId:u.id,expires:Date.now()+SESSION_MS});
  return json(res,200,{user:userPublic(u)},{'Set-Cookie':`${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS/1000}${process.env.NODE_ENV==='production'?'; Secure':''}`});
 }
 const session=getSession(req),user=session?.user;
 if(method==='POST'&&url.pathname==='/api/logout'){if(session)sessions.delete(session.token);return json(res,200,{ok:true},{'Set-Cookie':`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`})}
 if(method==='GET'&&url.pathname==='/api/me')return user?json(res,200,{user:userPublic(user),permissions:permissions[user.role]}):fail(res,401,'Sign in required');
 if(!url.pathname.startsWith('/api/'))return fail(res,404,'Not found');
 if(!user)return fail(res,401,'Sign in required');
 if(method==='GET'&&url.pathname==='/api/dashboard')return can(user,'dashboard:read')?json(res,200,dashboard()):fail(res,403,'You do not have dashboard access');
 if(method==='GET'&&url.pathname==='/api/users')return can(user,'users:read')?json(res,200,list('users')):fail(res,403,'Only administrators can view users');
 if(method==='POST'&&url.pathname==='/api/users'){
  if(!can(user,'users:write'))return fail(res,403,'Only administrators can manage users');const b=await parseBody(req);
  if(!b.name||!b.email||!roles.includes(b.role)||String(b.password||'').length<12)return fail(res,400,'Name, valid role, email and a 12-character password are required');
  try{const id=db.prepare('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)').run(b.name,String(b.email).trim().toLowerCase(),hashPassword(b.password),b.role,now()).lastInsertRowid;recordActivity(user,'created','user',Number(id));return json(res,201,userPublic(db.prepare('SELECT * FROM users WHERE id=?').get(id)))}catch(e){return fail(res,400,'Email is already in use')}
 }
 if(method==='POST'&&parts[1]==='payments'&&parts.length===2){
  if(!can(user,'invoices:write'))return fail(res,403,'You do not have permission to record payments');const b=await parseBody(req),invoice=db.prepare('SELECT * FROM invoices WHERE id=?').get(Number(b.invoice_id)),amount=Number(b.amount);
  if(!invoice||!Number.isFinite(amount)||amount<=0||amount>invoice.amount-invoice.paid_amount)return fail(res,400,'Choose an invoice and a valid payment amount');
  const received=b.received_on||dateToday();db.prepare('INSERT INTO payments(invoice_id,amount,received_on,method,reference,notes,created_at) VALUES(?,?,?,?,?,?,?)').run(invoice.id,amount,received,b.method||'',b.reference||'',b.notes||'',now());
  const paid=invoice.paid_amount+amount;db.prepare('UPDATE invoices SET paid_amount=?,status=?,updated_at=? WHERE id=?').run(paid,paid>=invoice.amount?'Paid':'Partially paid',now(),invoice.id);recordActivity(user,'recorded payment','invoice',invoice.id,`${amount} ${received}`);return json(res,201,{ok:true});
 }
 if(parts[0]==='api'&&definitions[parts[1]]){
  const resource=parts[1],permission=definitions[resource].perm;if(!can(user,permission+':'+(method==='GET'?'read':'write')))return fail(res,403,'You do not have permission for this action');
  if(method==='GET'&&parts.length===2)return json(res,200,list(resource));
  if(method==='POST'&&parts.length===2){try{return json(res,201,{id:insertRecord(resource,await parseBody(req),user)})}catch(e){return fail(res,e.message.includes('UNIQUE')?409:400,e.message.includes('UNIQUE')?'A record with that value already exists':e.message)}}
  if(method==='PATCH'&&parts.length===3){try{updateRecord(resource,Number(parts[2]),await parseBody(req),user);return json(res,200,{ok:true})}catch(e){return fail(res,400,e.message)}}
  if(method==='DELETE'&&parts.length===3){if(!can(user,'records:delete'))return fail(res,403,'Only administrators can delete records');const d=definitions[resource],result=db.prepare(`DELETE FROM ${d.table} WHERE id=?`).run(Number(parts[2]));if(!result.changes)return fail(res,404,'Record not found');recordActivity(user,'deleted',resource,Number(parts[2]));return json(res,200,{ok:true})}
 }
 if(method==='GET'&&url.pathname==='/api/payments')return can(user,'invoices:read')?json(res,200,list('payments')):fail(res,403,'Access denied');
 if(method==='GET'&&url.pathname==='/api/activity')return json(res,200,list('activity'));
 return fail(res,404,'Not found');
}
const server=http.createServer((req,res)=>{route(req,res).catch(e=>{console.error(e);if(!res.headersSent)fail(res,500,'Something went wrong')})});
server.listen(PORT,HOST,()=>console.log(`Northstar Recruitment OS running at http://${HOST}:${PORT}`));
process.on('SIGINT',()=>{db.close();server.close(()=>process.exit(0))});process.on('SIGTERM',()=>{db.close();server.close(()=>process.exit(0))});

