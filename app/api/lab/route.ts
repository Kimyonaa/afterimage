import { cases, parseState, transition } from '@/lib/afterimage/fixtures';
export async function GET(request:Request) { return Response.json({state:parseState(request.headers.get('cookie')),cases},{headers:{'Cache-Control':'no-store'}}); }
export async function POST(request:Request) {
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin) return Response.json({error:'Origin mismatch'},{status:403});
 try { const body=await request.json() as {action:string;caseId?:string};
 if(!['reset','revoke','repair'].includes(body.action)) return Response.json({error:'Invalid action'},{status:400});
 const state=transition(parseState(request.headers.get('cookie')),body.action,body.caseId);
 return Response.json({state},{headers:{'Cache-Control':'no-store','Set-Cookie':`afterimage_lab=${encodeURIComponent(JSON.stringify(state))}; Path=/; HttpOnly; SameSite=Lax${new URL(request.url).protocol==='https:'?'; Secure':''}`}});
 } catch {return Response.json({error:'Invalid request'},{status:400});}
}
