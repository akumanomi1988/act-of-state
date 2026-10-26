import { McpServer } from '@modelcontextprotocol/server'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import * as z from 'zod/v4'

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid=z.string().regex(UUID,'A valid UUID is required')
const dossier=z.string().min(1).max(120).regex(/^[a-z0-9-]+$/)
const option=dossier
const confirm=z.literal(true).describe('Explicitly confirm this authoritative political operation')
const maxResponseBytes=800_000

export function loadConfig(env=process.env) {
  const raw=env.AOS_SUPABASE_URL
  const key=env.AOS_SUPABASE_PUBLISHABLE_KEY
  const token=env.AOS_USER_ACCESS_TOKEN
  if(!raw||!key||!token||key.length<20||token.length<40)
    throw new Error('AOS_MCP_CONFIG_REQUIRED')
  let url
  try{url=new URL(raw)}catch{throw new Error('AOS_MCP_INVALID_URL')}
  const local=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)
  if((url.protocol!=='https:' && !(local&&url.protocol==='http:')) ||
    url.username||url.password||url.search||url.hash || url.pathname!=='/') {
    throw new Error('AOS_MCP_INVALID_URL')
  }
  if(/[\r\n]/.test(key+token))throw new Error('AOS_MCP_CONFIG_INVALID')
  return {base:url.origin,key,token}
}

export function makeRpc(config,request=fetch) {
  const endpoint=config.base+'/rest/v1/rpc/'
  return async function rpc(name,args={}) {
    if(!/^[a-z][a-z0-9_]{1,64}$/.test(name))throw Error('AOS_MCP_OPERATION_FORBIDDEN')
    const body=JSON.stringify(args)
    if(body.length>8192)throw Error('AOS_MCP_ARGS_TOO_LARGE')
    let response
    try {
      response=await request(endpoint+name,{
        method:'POST',redirect:'error',
        headers:{apikey:config.key,Authorization:'Bearer '+config.token,
          'Content-Type':'application/json'},
        body,signal:AbortSignal.timeout(12000)
      })
    }catch{
      throw Error('AOS_MCP_NETWORK_FAILURE')
    }
    const raw=await response.text()
    if(raw.length>maxResponseBytes)throw Error('AOS_MCP_RESPONSE_TOO_LARGE')
    let data
    try{data=JSON.parse(raw)}catch{throw Error('AOS_MCP_INVALID_RPC_RESPONSE')}
    if(!response.ok){
      const code=typeof data?.code==='string' && /^[A-Z0-9_]{1,80}$/i.test(data.code)
        ?data.code:'HTTP_'+response.status
      throw Error('AOS_MCP_RPC_'+code)
    }
    if(data===null)throw Error('AOS_MCP_NULL_RESPONSE')
    return data
  }
}

export function createAosMcpServer(rpc) {
  const server=new McpServer({name:'act-of-state',version:'0.1.0'},
    {maxToolInputElements:100})
  const wrapped=(operation,args)=>rpc(operation,args).then(result=>({
    content:[{type:'text',text:JSON.stringify(result)}]
  })).catch(error=>({
    isError:true,content:[{type:'text',text:
      /^AOS_MCP_/.test(error?.message)?error.message:'AOS_MCP_OPERATION_FAILED'}]
  }))
  const reads=[
    ['list_matches','List authenticated party memberships and invitations',
      z.object({}),()=>['list_my_matches',{}]],
    ['inspect_cabinet','Read your persistent solo government and signed history',
      z.object({government_id:uuid}),a=>['get_government_world',{p_government_id:a.government_id}]],
    ['inspect_match','Read a match you belong to, including parties and laws',
      z.object({match_id:uuid}),a=>['get_match_world',{p_match_id:a.match_id}]],
    ['inspect_parliament','Inspect binding votes, bills and status in an authorized match',
      z.object({match_id:uuid}),a=>['get_parliament_state',{p_match_id:a.match_id}]],
    ['inspect_calendar','Inspect the official weekly political clock for your match',
      z.object({match_id:uuid}),a=>['get_match_calendar',{p_match_id:a.match_id}]],
    ['inspect_diplomacy','Inspect signed geopolitical relations of your government or match',
      z.object({government_id:uuid}),a=>['get_diplomacy_state',{p_government_id:a.government_id}]],
    ['inspect_party_finances','Inspect your match campaign credits and immutable receipts',
      z.object({match_id:uuid}),a=>['get_party_finances',{p_match_id:a.match_id}]]
  ]
  for(const [name,description,inputSchema,parameters] of reads){
    server.registerTool(name,{description,inputSchema,
      annotations:{readOnlyHint:true,openWorldHint:false}},
      async a=>{const [operation,args]=parameters(a);return wrapped(operation,args)})
  }
  const actions=[
    ['record_stance','Record this party position for one policy dossier',
      z.object({match_id:uuid,dossier_id:dossier,dossier_version:z.number().int().min(1).max(100),
        option_id:option,confirm}),
      a=>['record_match_stance',{p_match_id:a.match_id,p_dossier_id:a.dossier_id,
        p_dossier_version:a.dossier_version,p_option_id:a.option_id}]],
    ['propose_bill','Propose a Parliamentary bill as the authorized ruling party',
      z.object({match_id:uuid,dossier_id:dossier,dossier_version:z.number().int().min(1).max(100),
        option_id:option,confirm}),
      a=>['propose_parliament_bill',{p_match_id:a.match_id,p_dossier_id:a.dossier_id,
        p_dossier_version:a.dossier_version,p_option_id:a.option_id}]],
    ['cast_vote','Cast an irreversible Parliamentary vote using the current party identity',
      z.object({bill_id:uuid,choice:z.enum(['yes','no','abstain']),confirm}),
      a=>['cast_parliament_vote',{p_bill_id:a.bill_id,p_choice:a.choice}]],
    ['sign_decision','Execute a signed national decision, requiring cabinet ownership and mandate',
      z.object({government_id:uuid,dossier_id:dossier,dossier_version:z.number().int().min(1).max(100),
        option_id:option,confirm}),
      a=>['submit_decision',{p_government_id:a.government_id,
        p_dossier_id:a.dossier_id,p_dossier_version:a.dossier_version,p_option_id:a.option_id}]]
  ]
  for(const [name,description,inputSchema,parameters] of actions){
    server.registerTool(name,{description,inputSchema,
      annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false}},
      async a=>{const [operation,args]=parameters(a);return wrapped(operation,args)})
  }
  return server
}

if(import.meta.url===new URL('file:'+process.argv[1]).href){
  try{
    const rpc=makeRpc(loadConfig())
    serveStdio(()=>createAosMcpServer(rpc))
  }catch(error){
    process.stderr.write((error instanceof Error?error.message:'AOS_MCP_BOOT_ERROR')+'\n')
    process.exitCode=1
  }
}

