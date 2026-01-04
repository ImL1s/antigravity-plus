// defines a simple polling function for autoAccept

import { autoAccept } from './auto_accept.js'

export async function simplePoll(buttonNames, interval) {
    while (true) {
        autoAccept(buttonNames)
        await new Promise(resolve => setTimeout(resolve, interval))
    }
}
