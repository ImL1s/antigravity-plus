

import { autoAll } from './auto_accept.js'

export async function simplePoll(buttonNames, interval) {
    while (true) {
        autoAll(buttonNames)
        await new Promise(resolve => setTimeout(resolve, interval))
    }
}
