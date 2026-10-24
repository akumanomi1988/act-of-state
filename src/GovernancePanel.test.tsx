import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GovernancePanel from './GovernancePanel'
import type { MatchPlayer } from './lib/multiplayer'

const mocks = vi.hoisted(() => ({
  fetchGovernanceState: vi.fn(),
  inviteCoalitionPartner: vi.fn(),
  respondCoalitionInvite: vi.fn(),
  proposeConfidenceMotion: vi.fn(),
  castConfidenceVote: vi.fn(),
  finalizeConfidenceMotion: vi.fn()
}))
vi.mock('./lib/governance', () => mocks)
const user1 = '10000000-0000-4000-8000-000000000001'
const user2 = '10000000-0000-4000-8000-000000000002'
const user3 = '10000000-0000-4000-8000-000000000003'
const matchId = '90000000-0000-4000-8000-000000000009'
const players = [user1,user2,user3].map((id,i) => ({
  match_id: matchId,user_id:id,seat_no:i+1,party_name:'Party '+(i+1),
  manifesto_policy:50,mandate_seats:i===0?55:i===1?35:10,
  joined_at:'2026-10-23T00:00:00Z',is_ready:false
})) as MatchPlayer[]
const motion = {
  id:'80000000-0000-4000-8000-000000000008',match_id:matchId,
  proposer_id:user3,candidate_id:user2,incumbent_id:user1,status:'open',
  created_at:'2026-10-23T11:00:00Z',closes_at:'2026-10-24T11:00:00Z',
  closed_at:null,rule_version:'confidence-constructive-v1'
}
const base = {
  hostUserId:user1,totalSeats:100,coalitionSeats:55,coalition:[],
  motions:[],votes:[],serverNow:'2026-10-23T12:00:00Z'
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchGovernanceState.mockResolvedValue(base)
  mocks.inviteCoalitionPartner.mockResolvedValue({})
  mocks.respondCoalitionInvite.mockResolvedValue({})
  mocks.proposeConfidenceMotion.mockResolvedValue({})
  mocks.castConfidenceVote.mockResolvedValue({})
  mocks.finalizeConfidenceMotion.mockResolvedValue({})
})
afterEach(cleanup)

describe('governance panel', () => {
  it('shows authoritative seat weights and invites only when cabinet selects a partner', async () => {
    render(<GovernancePanel matchId={matchId} userId={user1}
      players={players} active={true} onGovernmentChanged={vi.fn()} />)
    expect(await screen.findByText('55 / 100 escaños')).toBeInTheDocument()
    expect(mocks.inviteCoalitionPartner).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Invitar a un partido al gobierno'), { target: {value:user2} })
    fireEvent.click(screen.getByRole('button', { name:'Proponer coalición' }))
    await waitFor(() => expect(mocks.inviteCoalitionPartner).toHaveBeenCalledWith(matchId,user2))
    expect(mocks.fetchGovernanceState).toHaveBeenCalledTimes(2)
  })

  it('allows an invited opposition party to accept without trusting client seat counts', async () => {
    mocks.fetchGovernanceState.mockResolvedValue({
      ...base,coalition:[{
        match_id:matchId,user_id:user2,leader_id:user1,
        status:'invited',updated_at:'2026-10-23T12:00:00Z'
      }]
    })
    render(<GovernancePanel matchId={matchId} userId={user2}
      players={players} active={true} onGovernmentChanged={vi.fn()} />)
    expect(await screen.findByText(/te invita a formar parte/)).toBeInTheDocument()
    expect(screen.queryByRole('button', {name:'Proponer coalición'})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name:'Aceptar invitación'}))
    await waitFor(() => expect(mocks.respondCoalitionInvite).toHaveBeenCalledWith(matchId,true))
  })

  it('uses authoritative motion resolution to trigger a full government reload', async () => {
    const onGovernmentChanged = vi.fn()
    mocks.fetchGovernanceState.mockResolvedValueOnce({
      ...base,motions:[motion],votes:[
        {motion_id:motion.id,user_id:user2,seat_weight:35,choice:'yes',created_at:'2026-10-23T12:00:00Z'},
        {motion_id:motion.id,user_id:user3,seat_weight:10,choice:'yes',created_at:'2026-10-23T12:00:00Z'}
      ]
    }).mockResolvedValueOnce({
      ...base,hostUserId:user2,coalitionSeats:35,
      motions:[{...motion,status:'passed',closed_at:'2026-10-23T12:01:00Z'}]
    })
    render(<GovernancePanel matchId={matchId} userId={user1}
      players={players} active={true} onGovernmentChanged={onGovernmentChanged} />)
    expect(await screen.findByText(/Moción abierta para investir/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Apoyar al candidato'}))
    await waitFor(() => expect(mocks.castConfidenceVote).toHaveBeenCalledWith(motion.id,'yes'))
    await waitFor(() => expect(onGovernmentChanged).toHaveBeenCalledTimes(1))
  })

  it('reports a failed initial membership read without revealing negotiation controls', async () => {
    mocks.fetchGovernanceState.mockRejectedValue(new Error('MATCH_FORBIDDEN'))
    render(<GovernancePanel matchId={matchId} userId={user3}
      players={players} active={true} onGovernmentChanged={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No perteneces a esta partida')
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo recuperar')
    expect(screen.queryByRole('button',{name:'Registrar moción'})).not.toBeInTheDocument()
  })

  it('does not expose mutation buttons in lobby', async () => {
    render(<GovernancePanel matchId={matchId} userId={user1}
      players={players} active={false} onGovernmentChanged={vi.fn()} />)
    expect(await screen.findByText('55 / 100 escaños')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Proponer coalición'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Registrar moción'})).not.toBeInTheDocument()
  })

  it('does not invent accepted actions when the server rejects a vote', async () => {
    mocks.fetchGovernanceState.mockResolvedValue({
      ...base,motions:[motion]
    })
    mocks.castConfidenceVote.mockRejectedValue(new Error('CONFIDENCE_VOTE_CLOSED'))
    render(<GovernancePanel matchId={matchId} userId={user2}
      players={players} active={true} onGovernmentChanged={vi.fn()} />)
    expect(await screen.findByText(/Moción abierta para investir/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Mantener el gobierno'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('CONFIDENCE_VOTE_CLOSED')
    expect(screen.queryByText(/Voto de confianza registrado/)).not.toBeInTheDocument()
  })
})
