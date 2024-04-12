import Game from './core/Game.js'

const connectButton = document.getElementById('connect-button-wrapper')
const usernameField = document.querySelector('.username-field')
const spawnButton = document.getElementById('spawn-button-wrapper')
const respawnButton = document.getElementById('respawn-button-wrapper')



assaultField.checked = true

Game.initLoadingManager()
Game.load()

connectButton.querySelector('#connect-button').addEventListener('click', () => {
    if( usernameField.value === '' ) {
        Game.setUsername('no name' + Math.round(Math.random()*10000).toString())
    } else {
        Game.setUsername(usernameField.value)
    }
    Game.joinLobby()
    connectButton.style.display = 'none'
})



spawnButton.querySelector('#spawn-button').addEventListener('click', () => {
    Game.spawn()
    spawnButton.style.display = 'none'
})

respawnButton.querySelector('#respawn-button').addEventListener('click', () => {
    Game.respawn()
    respawnButton.style.display = 'none'
})

const assaultField = document.getElementById('weapon-checkbox01')
const shotgunField = document.getElementById('weapon-checkbox02')
const sniperField = document.getElementById('weapon-checkbox03')

const respawnAssaultField = document.getElementById('weapon-checkbox11')
const respawnShotgunField = document.getElementById('weapon-checkbox12')
const respawnSniperField = document.getElementById('weapon-checkbox13')


assaultField.addEventListener('click', (event) => {
    if(!assaultField.checked) {
        event.preventDefault()
        event.stopPropagation()
    } else {
        Game.setClass(1)
        shotgunField.checked = false
        sniperField.checked = false
    }
})

shotgunField.addEventListener('click', (event) => {
    if(!shotgunField.checked) {
        event.preventDefault()
        event.stopPropagation()
    } else {
        Game.setClass(2)
        assaultField.checked = false
        sniperField.checked = false
    }
})

sniperField.addEventListener('click', (event) => {
    if(!sniperField.checked) {
        event.preventDefault()
        event.stopPropagation()
    } else {
        Game.setClass(3)
        shotgunField.checked = false
        assaultField.checked = false
    }
})

respawnAssaultField.addEventListener('click', (event) => {
    if(!respawnAssaultField.checked) {
        event.preventDefault()
        event.stopPropagation()
    } else {
        Game.setClass(1)
        respawnShotgunField.checked = false
        respawnSniperField.checked = false
    }
})

respawnShotgunField.addEventListener('click', (event) => {
    if(!respawnShotgunField.checked) {
        event.preventDefault()
        event.stopPropagation()
    } else {
        Game.setClass(2)
        respawnAssaultField.checked = false
        respawnSniperField.checked = false
    }
})

respawnSniperField.addEventListener('click', (event) => {
    if(!respawnSniperField.checked) {
        event.preventDefault()
        event.stopPropagation()
    } else {
        Game.setClass(3)
        respawnShotgunField.checked = false
        respawnAssaultField.checked = false
    }
})

const settings = document.getElementById('settings-wrapper')
const spawnSettingsButton = settings.getElementById('settings-button-spawn')
const blocker = document.querySelector('.blocker')

spawnSettingsButton.addEventListener('click', () => {
    
})
