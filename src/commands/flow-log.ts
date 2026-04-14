import { getSessionId } from '../bootstrap/state.js'
import type { Command, LocalCommandCall } from '../types/command.js'
import { getInternalFlowLogPath } from '../utils/internalFlowLogger.js'

const call: LocalCommandCall = async () => {
  const sessionId = getSessionId()
  const logPath = getInternalFlowLogPath(sessionId)

  return {
    type: 'text',
    value: `Session ${sessionId}\n${logPath}`,
  }
}

const flowLog = {
  type: 'local',
  name: 'flow-log',
  aliases: ['internal-flow'],
  description: 'Show the current session internal flow log path',
  supportsNonInteractive: true,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default flowLog