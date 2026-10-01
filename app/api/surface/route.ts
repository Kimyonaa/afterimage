import { observe, parseState, type Surface } from '@/lib/afterimage/fixtures';
export async function GET(request:Request) {
 const surface=new URL(request.url).searchParams.get('name') as Surface;
 if(!['document','search','activity','tab'].includes(surface)) return Response.json({error:'Unknown surface'},{status:400});
 const result=observe(parseState(request.headers.get('cookie')),surface);
 return Response.json(result,{status:result.status,headers:{'Cache-Control':'no-store'}});
}
