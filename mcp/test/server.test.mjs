import test from 'node:test'
import assert from 'node:assert/strict'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { createAosMcpServer, loadConfig, makeRpc } from '../server.mjs'

const gameId='77777777-7777-4777-8777-777777777777'
const billId='88888888-8888-4888-8888-888888888888'
const environment={
  AOS_SUPABASE_URL:'https://aos-dev.supabase.co/',
  AOS_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_value',
  AOS_USER_ACCESS_TOKEN:'mock.jwt.claim.with_extra_long_synthetic_random_data'
}
test('requires explicit authenticated configuration and restricts destination protocols',()=>{
  assert.deepEqual(loadConfig(environment),{
    base:'https://aos-dev.supabase.co',
    key:environment.AOS_SUPABASE_PUBLISHABLE_KEY,
    token:environment.AOS_USER_ACCESS_TOKEN
  })
  for(const raw of ['http://malicious.example/','file:///etc/passwd',
    'https://user:pass@aos-dev.supabase.co/','https://aos-dev.supabase.co/extra',
    'https://aos-dev.supabase.co/?secret=1'])
    assert.throws(()=>loadConfig({...environment,AOS_SUPABASE_URL:raw}),
      /AOS_MCP_INVALID_URL/)
  assert.throws(()=>loadConfig({...environment,AOS_USER_ACCESS_TOKEN:''}),
    /AOS_MCP_CONFIG_REQUIRED/)
})
test('passes the user JWT with a publishable API key and never sends a privileged role',async()=>{
  const calls=[]
  const fetchStub=async(url,init)=>{
    calls.push({url,init})
    return new Response(JSON.stringify([{id:gameId}]),{status:200,
      headers:{'Content-Type':'application/json'}})
  }
  const rpc=makeRpc(loadConfig(environment),fetchStub)
  assert.deepEqual(await rpc('list_my_matches',{}),[{id:gameId}])
  assert.equal(calls[0].url,'https://aos-dev.supabase.co/rest/v1/rpc/list_my_matches')
  assert.equal(calls[0].init.method,'POST')
  assert.equal(calls[0].init.headers.apikey,environment.AOS_SUPABASE_PUBLISHABLE_KEY)
  assert.equal(calls[0].init.headers.Authorization,
    'Bearer '+environment.AOS_USER_ACCESS_TOKEN)
  assert.equal(calls[0].init.body,'{}')
  await assert.rejects(rpc('../another',{}),/AOS_MCP_OPERATION_FORBIDDEN/)
})
test('does not leak bearer tokens, detailed responses or input after denied RPC calls',async()=>{
  const client=makeRpc(loadConfig(environment),async()=>new Response(JSON.stringify({
    code:'42501',message:'SECRET_INTERNAL_TOKEN_'+environment.AOS_USER_ACCESS_TOKEN
  }),{status:403}))
  await assert.rejects(client('get_match_world',{p_match_id:gameId}),
    e=>e.message==='AOS_MCP_RPC_42501')
})

async function setupServer(rpc) {
  const handler=createMcpHandler(()=>createAosMcpServer(rpc))
  const transport=new StreamableHTTPClientTransport(new URL('http://test.local/mcp'),{
    fetch:(url,init)=>handler.fetch(new Request(url,init))
  })
  const client=new Client({name:'aos-mcp-test',version:'1.0.0'})
  await client.connect(transport)
  return {client,transport}
}
test('real MCP client lists game tools, enforces explicit confirmation, and preserves user ownership parameters',async()=>{
  const calls=[]
  const rpc=async(name,args)=>{calls.push([name,args]);return {operation:name,parameters:args}}
  const {client,transport}=await setupServer(rpc)
  try{
    const catalog=await client.listTools()
    assert.equal(catalog.tools.length,11)
    assert.equal(catalog.tools.find(x=>x.name==='inspect_diplomacy')
      .annotations.readOnlyHint,true)
    assert.equal(catalog.tools.find(x=>x.name==='sign_decision')
      .annotations.destructiveHint,true)
    const response=await client.callTool({name:'inspect_diplomacy',
      arguments:{government_id:gameId}})
    assert.equal(response.isError,undefined)
    assert.deepEqual(calls[0],['get_diplomacy_state',{p_government_id:gameId}])
    const denied=await client.callTool({name:'cast_vote',
      arguments:{bill_id:billId,choice:'yes'}})
    assert.equal(denied.isError,true)
    assert.equal(calls.length,1,'a write without confirm cannot reach PostgREST')
    const invalid=await client.callTool({name:'inspect_match',
      arguments:{match_id:'not-a-uuid'}})
    assert.equal(invalid.isError,true)
    assert.equal(calls.length,1)
    const approved=await client.callTool({name:'cast_vote',
      arguments:{bill_id:billId,choice:'yes',confirm:true}})
    assert.equal(approved.isError,undefined)
    assert.deepEqual(calls[1],['cast_parliament_vote',
      {p_bill_id:billId,p_choice:'yes'}])
  }finally{
    await client.close();await transport.close()
  }
})
test('denied membership from the game backend remains a failed MCP tool',async()=>{
  const {client,transport}=await setupServer(async()=>{throw Error('AOS_MCP_RPC_42501')})
  try{
    const reply=await client.callTool({name:'inspect_match',arguments:{match_id:gameId}})
    assert.equal(reply.isError,true)
    assert.equal(reply.content[0].text,'AOS_MCP_RPC_42501')
  }finally{
    await client.close();await transport.close()
  }
})


test('shipped stdio process completes real MCP protocol handshake and rejects unsigned actions',async()=>{
  const client=new Client({name:'aos-stdio-smoke',version:'1.0.0'})
  const transport=new StdioClientTransport({
    command:process.execPath,args:[new URL('../server.mjs',import.meta.url).pathname],
    env:{...process.env,...environment}
  })
  await client.connect(transport)
  try {
    assert.equal(client.getServerVersion()?.name,'act-of-state')
    const catalog=await client.listTools()
    assert.equal(catalog.tools.length,11)
    const result=await client.callTool({name:'cast_vote',arguments:{bill_id:billId,choice:'yes'}})
    assert.equal(result.isError,true)
  }finally{
    await client.close()
  }
})
