import * as THREE from 'three'
//import * as Stats from 'stats'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import Stats from 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/17/Stats.js'
//import * as dat from 'dat.gui'
//import { FBXLoader } from 'three/addons/loaders/FBXLoader'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
//import { resolve } from 'promise';

// ALT controls //

class Game {
  constructor() {
    this.camera = null
    this.scene = null
    this.guiScene = null
    this.guiCamera = null
    this.renderer = null
    this.requestAnimId = {}
    this.gui = null

    this.canvas = null
    this.canvasPadding = null

    this.stats = null
    
    this.player= null
    this.players = {}
    this.velocity = null
    this.direction = null
    this.turnDelta = 0
    this.collidableObjects = null
    this.shootableObjects = null
    this.bullets = null

    this.clock = null
    this.oldElapsedTime = null
    this.deltaTime = null

    this.loadingManager = null

    this.isSafe = true
    this.safetyTimeout = null

    this.controls = null
    this.inputsDisabled = false

    this.leaderboardArray = null;
    this.killMessageArray = [];

    this.socket = null

    this.ui = {
      crosshair: null,

      loadingBar: document.getElementById('loading-bar'),
      body: document.querySelector('body'),
      spawnButton: document.getElementById('spawn-button-wrapper'),
      respawnButton: document.getElementById('respawn-button-wrapper'),
      leaderboard: document.getElementById('leaderboard'),
      respawnAssaultField: document.getElementById('weapon-checkbox11'),
      respawnShotgunField: document.getElementById('weapon-checkbox12'),
      respawnSniperField: document.getElementById('weapon-checkbox13'),
      healthBar: 
      { 
        wrapper: document.getElementById('health-bar'),
        bar: document.getElementById('bar'),
        shadow: document.getElementById('bar-shadow'),
        health: document.getElementById('health-number')
      },
      weaponStats: 
      {
        ammoCount: document.getElementById('reload'),
        reloadTime: document.getElementById('reload-time'),
        reloadingText: document.getElementById('reloading'),
      },
      killMessages: document.getElementById('kill-message-wrapper'),
      scope: document.getElementById('scope'),
    }
  }

  initLoadingManager = () => {
    this.loadingManager = new THREE.LoadingManager(
      //onload
      ()=>{
        
      },

      //progress
      (itemUrl, itemsLoaded, itemsTotal) => {
        const progressRatio = itemsLoaded / itemsTotal
        this.ui.loadingBar.style.transform = `scaleX(${progressRatio})`
      },

      (err) => {
        console.log('An error accured while loading!')
        throw err
      }
    )
  }

  load = () => {
    this.initModels().then(() => {
      this.initScene()
      this.initGui()
      this.initMap()
      this.initSkybox()
      this.initPlayer()
      this.initStats()
      this.initControls()
      this.initCombat()
      })
  }

  joinLobby = () => {
    this.canvas.setScale(2)
    this.initSocket() 
    this.startTick()
    this.startOrbitAnimation()
    this.ui.spawnButton.style.display = 'block'
    this.ui.leaderboard.style.display = 'block'
    this.ui.killMessages.style.display = 'block'
    this.ui.killMessages.style.left = '0'
  }

  spawn = () => {
    this.player.inGame = true
    this.sendSpawn()
    this.stopOrbitAnimation()
    this.canvas.setScale(1)
    this.updateUIForSpawn()
    this.updateLeaderboard()
    this.#setClass()
    this.activateControls()
    this.activateShooting()
    this.camera.position.set( 0 , 10 , 0)
    this.scene.add(this.camera)
    this.startAnimation() // <= calls inGameTick
  }

  respawn = () => {
    this.stopOrbitAnimation()
    this.player.inGame = true
    this.inputsDisabled = false
    this.player.health = 100
    this.updateUIForSpawn()

    this.scene.add(this.player.feet)
    this.scene.add(this.player.body)
    this.scene.add(this.camera)
    this.camera.position.set( 0 , 10 , 0 )

    this.sendSpawn()
    this.updateLeaderboard()
    this.#setClass()

    this.controls.lock()
    this.startAnimation()
  }

  tick = () => {
    const elapsedTime = this.clock.getElapsedTime()
    this.deltaTime = elapsedTime - this.oldElapsedTime
    this.oldElapsedTime = elapsedTime

    this.updateOtherPlayers(this.deltaTime)

    this.updateBulletPositions(this.deltaTime)
  }

  inGameTick = () => {
    this.stats.begin()
    
    if ( this.deltaTime <= 1 / 10 ) {
      this.updateVelocity(this.deltaTime)
      this.updatePosition(this.deltaTime)
    }
    this.updateUI(this.deltaTime)
    this.sendPosition()

    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    this.renderer.render(this.guiScene, this.guiCamera)
    this.stats.end()
  }

  orbitTick = () => {
    this.camera.position.y = 20


    this.camera.position.x = 35 * Math.cos( this.clock.getElapsedTime() / 10 )
    this.camera.position.z = 35 * Math.sin( this.clock.getElapsedTime() / 10 )
    this.camera.lookAt( 0 , 0 , 0 )

    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
  }

  
  updateVelocity = (deltaTime) => {
    this.direction.x = Number(this.moveLeft) - Number(this.moveRight)
    this.direction.z = Number(this.moveBackward) - Number(this.moveForward)

    this.speedMultiplier = 1
    if (this.moveBackward && !this.moveForward) {
      this.speedMultiplier = 0.75
    }
    
    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * this.player.speed * deltaTime * this.speedMultiplier
    }
    if (this.moveRight || this.moveLeft) {
      this.velocity.x -= this.direction.x * this.player.speed * deltaTime * this.speedMultiplier
    }
    if(this.isJumping && this.velocity.y === 0) {
      this.velocity.y += this.player.jump
    }
    this.velocity.y -= 42 * deltaTime
    
    this.velocity.z -= this.velocity.z * 10 * deltaTime
    this.velocity.x -= this.velocity.x * 10 * deltaTime
  }

  updatePosition = (deltaTime) => {

    this.controls.moveForward(this.velocity.z * deltaTime)
    this.controls.moveRight(this.velocity.x * deltaTime)
    this.camera.position.y +=  this.velocity.y * deltaTime
    
    
    this.fixForBoxCollisions()
    
    this.player.feet.position.set(this.camera.position.x, this.camera.position.y - this.player.height, this.camera.position.z)
    this.player.body.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z)

    if (this.lastCameraTurn) {
      this.turnDelta += (this.camera.rotation.z - this.lastCameraTurn)
    }
    this.lastCameraTurn = this.camera.rotation.z

    this.player.feet.rotation.y = this.camera.rotation.z
    this.player.body.lookAt(new THREE.Vector3().add(this.camera.position, this.lookVector()))
  }

  fixForBoxCollisions = () => {
    for (let element of this.collidableObjects) {
      const positionObjectSpace = element.object.WorldToLocal(this.camera.position)
      if (
        Math.abs(positionObjectSpace.x) + this.player.width < element.x &&
        Math.abs(positionObjectSpace.z) + this.player.width < element.z &&
        positionObjectSpace.y - this.player.height < element.y &&
        positionObjectSpace.y > - element.y
      ) {
        switch (
          Math.min(
            positionObjectSpace
          )
        ) {
          // case (this.camera.position.z + this.player.width - element.znegative):
          //   this.camera.position.z = element.znegative - this.player.width
          // break
          // case (- this.camera.position.z + this.player.width + element.zpositive):
          //   this.camera.position.z = element.zpositive + this.player.width
          // break
          // case (this.camera.position.x + this.player.width - element.xnegative):
          //   this.camera.position.x = element.xnegative - this.player.width
          // break
          // case (- this.camera.position.x + this.player.width + element.xpositive):
          //   this.camera.position.x = element.xpositive + this.player.width
          // break
          // case (- this.camera.position.y + this.player.height + element.top):
          //   this.camera.position.y = element.top + this.player.height
          //   this.isJumping = false
          //   this.velocity.y = 0
          // break
          // case (this.camera.position.y - element.bottom):
          //   this.camera.position.y = element.bottom - 0.05
          //   this.velocity.y *= -0.6
          // break
        }
      }
    }
  }

  updateUIForSpawn = () => {
    document.body.appendChild( this.stats.dom )
    this.resetHealthBar()
    this.ui.weaponStats.ammoCount.parentNode.style.display = 'block'
    this.ui.killMessages.style.left = '100px'
    //this.gui.show()
  }

  activateControls = () => {
    this.controls.lock()

    this.canvas.addEventListener("click", () => {
      this.controls.lock()
    })

    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement) {
        this.moveForward = false
        this.moveBackward = false
        this.moveLeft = false
        this.moveRight = false
      }
    })

    window.addEventListener("keydown", this.onKeyDown)
    window.addEventListener("keyup", this.onKeyUp)
  }

  onKeyDown = (e) => {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.moveForward = true;
        break
      case "KeyS":
      case "ArrowDown":    
        this.moveBackward = true
        break
      case "KeyA":
      case "ArrowLeft":
        this.moveLeft = true
        break
      case "KeyD":
      case "ArrowRight":
        this.moveRight = true
        break
      case "Space":
        this.isJumping = true
        break
      case "ShiftLeft":
        this.shiftPressed = true
        if (!this.isScoped && !this.isShifted) {
          this.isShifted = true
          this.player.speed /= 3
        }
        break
    }
  }

  onKeyUp = (e) => {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.moveForward = false
        break
      case "KeyS":
      case "ArrowDown":
        this.moveBackward = false
        break
      case "KeyA":
      case "ArrowLeft":
        this.moveLeft = false
        break
      case "KeyD":
      case "ArrowRight":
        this.moveRight = false
        break
      case "KeyR":
        if (this.player.class === 1) this.reload(20)
        else if(this.player.class === 2) this.reload(2)
        else this.reload(5)
        break
      case "ShiftLeft":
        this.shiftPressed = false
        if (this.isShifted) {
          this.isShifted = false
          this.player.speed *= 3
        }
        break
    }
  }

  reload = (magazine) => {
    this.ui.weaponStats.reloadingText.style.display = 'block'
    this.ui.weaponStats.reloadTime.style.display = 'block'
    this.reloadTime = 3
    const reloadClock = setInterval(() => {
      this.reloadTime -= 0.1
      this.ui.weaponStats.reloadTime.textContent = `${Math.round(this.reloadTime * 100)/100} sec`
      if(this.reloadTime <= 0.05) {
        clearInterval(reloadClock)
        this.reloadTime = 0
        this.magazine = magazine
        this.isReloading = false
        this.ui.weaponStats.reloadingText.style.display = 'none'
        this.ui.weaponStats.reloadTime.style.display = 'none'
        this.updateWeaponStats()
      }
    }, 100)
  }

  createDamageParticle = (position, number) => {
    const particlePosition = new Float32Array([
      Math.random(),Math.random(), Math.random()
    ])
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePosition, 3))
    const particleMaterial = new THREE.PointsMaterial({
      size: 50,
      sizeAttenuation: false,
      depthTest: false,
      transparent: true,
      alphaTest: 0.0001
    })

    const addParticle = (number) => {
      particleMaterial.map =  this.svgNums.saved[number]
      particleMaterial.alphaMap =  this.svgNums.saved[number]
      const particle = new THREE.Points(particleGeometry, particleMaterial)
      particle.position.copy( position )
      this.scene.add( particle )

      let i = 100
      const particleClock = setInterval(() => {
        i-=1
        particle.material.size *= (1 + i / 20000)
        particle.position.y += (i / 3000)
        if(i < 0) {
          this.scene.remove(particle)
          particle.material.dispose()
          particle.geometry.dispose()
          clearInterval(particleClock)
        }
      }, 10)
    }

    if (!this.svgNums.saved[number]) {
      this.generateSvgNumber(number).then(() => {
        addParticle(number)
      })
    } else {
      addParticle(number)
    }
  }

  generateSvgNumber = (number) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = 100
    canvas.height = 100

    const svgImage = new Image()
    let svgString = this.svgNums.default.slice()
    if (number < 10) {
      svgString += this.svgNums[number].code.slice().replace(`123456789`, `0`)
    } else if (number === 100) {
      svgString += this.svgNums[100]
    } else {
      svgString += this.svgNums[(number-number%10)/10].code.slice().replace(`123456789`, `0`)
      svgString += this.svgNums[number%10].code.slice().replace(`123456789`, `${this.svgNums[(number-number%10)/10].width}`)
    }
    svgString += `</g></svg>`
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'})
    const url = URL.createObjectURL(svgBlob)
    svgImage.src = url
    return new Promise((resolve) => {
      svgImage.onload = () => {
        ctx.drawImage( svgImage, 0, 0 )
        const texture = new THREE.Texture( canvas )
        texture.needsUpdate = true
        this.svgNums.saved[number] = texture
        resolve()
      }
    })
  }

  createBullet = () => {
    const bulletPosition = new Float32Array([
      0, 0, 0
    ])
    const bulletGeometry = new THREE.BufferGeometry()
    bulletGeometry.setAttribute('position', new THREE.BufferAttribute(bulletPosition, 3))
    const bulletMaterial = new THREE.PointsMaterial({
      size: 0.04,
      sizeAttenuation: true
    })
    let bulletMesh = new THREE.Points(bulletGeometry, bulletMaterial)
    bulletMesh.position.copy(this.camera.position)
    
    bulletMesh.position.copy(this.camera.localToWorld(new THREE.Vector3().copy(this.gun.position)))
  
    this.scene.add(bulletMesh)

    bulletMesh.ID = Math.random()
    
    const bulletDirection = new THREE.Vector3().copy(this.lookVector())
     if ( !this.isScoped ){
      bulletDirection.y += 0.015
      bulletDirection.applyAxisAngle(new THREE.Vector3(0,1,0), 0.01)
      bulletDirection.normalize() 
     }

    const bloomVector = new THREE.Vector3(0.5 - Math.random(), 0.5 - Math.random(), 0.5 - Math.random())
    bloomVector.normalize()
      .multiplyScalar(this.bloom)
    bulletDirection.add(bloomVector)
    bulletDirection.normalize()

    this.createTracer(bulletMesh.position, bulletDirection, this.bulletspeed)


    this.bullets.push({
      direction: bulletDirection,
      position: bulletMesh.position,
      shooter: this.player.id,
      speed: this.bulletspeed,
      startPosition: new THREE.Vector3().copy(this.camera.position),
      mesh: bulletMesh,
      damage: this.damage
    })

    

    setTimeout(() => {
      if(bulletMesh != null){
        bulletMesh.geometry.dispose()
        bulletMesh.material.dispose()
        this.scene.remove(bulletMesh)
        bulletMesh = null
      }
    }, this.bulletTime * 1000)

    this.sendShoot({
      direction: bulletDirection.toArray(),
      quaternion: bulletMesh.quaternion.toArray(),
      position: bulletMesh.position.toArray(),
      shooter: this.player.id,
      speed: this.bulletspeed,
      startPosition: new THREE.Vector3().copy(this.camera.position),
      time: this.bulletTime,
      damage: this.damage
    })
  }

  createTracer = (position, direction, speed) => {
    this.tracerRaycaster.set(position, direction)
    const hits = this.tracerRaycaster.intersectObjects(this.shootableObjects)
    let distance = 20
    if(hits[0]) {
      distance = Math.min(hits[0].distance, distance)
    }
    const geometry = new THREE.CylinderGeometry( 0.01, 0.01, distance, 3 )
    const material = new THREE.MeshBasicMaterial( {color: 0xffbb33, opacity: 0.6, transparent:true } )
    const tracer = new THREE.Mesh( geometry, material ) 
    this.scene.add( tracer )
    tracer.position.copy(position)
    tracer.position.x += direction.x * distance / 2
    tracer.position.y += direction.y * distance / 2
    tracer.position.z += direction.z * distance / 2
    const lookTarget = new THREE.Vector3().copy(direction).add(position)
    tracer.lookAt(lookTarget)
    tracer.rotateOnAxis(new THREE.Vector3(1,0,0), Math.PI / 2)
    // tracer.scale.y = 0

    let i = 10
    const die = setInterval(() => {
      i--
      material.opacity /= 1.3
      if (i <= 0) {
        clearInterval(die)
        this.scene.remove(tracer)
        material.dispose()
        geometry.dispose()
      }
    }, 30)
  }

  setClass = (classCode) => {
    this.player.class = classCode
  }

  #setClass = () => {
    switch (this.player.class) {
      case 1:
        this.setAssault()
        break
      case 2:
        this.setShotgun()
        break
      case 3:
        this.setSniper()
        break
    }
    this.updateWeaponStats()
  }


  setAssault = () => {
    console.log('set assault')
    this.magazine = 20
    this.reloadTime = 0 // 5
    this.firerate = 1000/6 //ms between bullets
    this.bloom = 0.015
    this.bulletspeed = 100
    this.rapidfire = null 
    this.bulletTime = 0.75
    this.damage = 23

    this.ui.crosshair.top.position.z = -17.5
    this.ui.crosshair.bottom.position.z = 17.5
    this.ui.crosshair.right.position.x = -17.5
    this.ui.crosshair.left.position.x = 17.5

    const shoot = () => {
          
      if(this.magazine === 1) {
        clearInterval(this.rapidfire)
        this.reload(20)
        console.log('out of ammo')
      }
      
      this.magazine--

      this.updateWeaponStats()
      this.createBullet()
    }

    this.canvas.parentNode.removeEventListener('mousedown', this.fire)
    
    this.fire = (e) => {
      const r = new THREE.Raycaster()
      if (this.reloadTime === 0 && this.controls.isLocked && e.button === 0) {
        shoot()
        this.rapidfire = setInterval( () => {
          shoot()
        }, this.firerate)
      } else if (this.magazine === 0 && this.controls.isLocked && e.button === 0){
        if(!this.isReloading){
          this.reload(20)
        }
      }
    }

    this.canvas.parentNode.addEventListener('mousedown', this.fire)
  }

  setSniper = () => {
    this.magazine = 5
    this.reloadTime = 0 // 5
    this.firerate = 2000
    this.bloom = 0
    this.bulletspeed = 75
    this.bulletTime = 100
    this.damage = 100

    this.ui.crosshair.top.position.z = -12.5
    this.ui.crosshair.bottom.position.z = 12.5
    this.ui.crosshair.right.position.x = -12.5
    this.ui.crosshair.left.position.x = 12.5

    this.canvas.parentNode.removeEventListener('mousedown', this.fire)
    
    this.fire = (e) => {
      if (this.cooldown === 0 && this.reloadTime === 0 && this.controls.isLocked && e.button === 0) {          
        if(this.magazine === 1) {
          this.reloadTime = 5
          console.log('out of ammo')
        }
        
        this.magazine--
  
        this.cooldown = 2
        const cooldownClock = setInterval(() => {
          this.cooldown -= 0.1
          if(this.cooldown <= 0.05) {
            clearInterval(cooldownClock)
            this.cooldown = 0
          }
        }, 100)

        this.updateWeaponStats()
        this.createBullet()
      } else if (this.magazine === 0 && this.controls.isLocked && e.button === 0 ){
        if(!this.isReloading){
          this.reload(5)
        }
      }
    }
    
    this.canvas.parentNode.addEventListener('mousedown', this.fire)
  }

  setShotgun = () => {
    this.magazine = 2
    this.reloadTime = 0 // 5
    this.firerate = 0 //semiautomatic
    this.bloom = 0.065
    this.bulletspeed = 50
    this.bulletTime = 0.25 //sec
    this.damage = 7

    this.ui.crosshair.top.position.z = -60
    this.ui.crosshair.bottom.position.z = 60
    this.ui.crosshair.right.position.x = -60
    this.ui.crosshair.left.position.x = 60

   
    this.canvas.parentNode.removeEventListener('mousedown', this.fire)
    
    this.fire = (e) => {
      if (this.cooldown === 0 && this.reloadTime === 0 && this.controls.isLocked && e.button === 0) {          
        if(this.magazine === 1) {
          this.reloadTime = 5
          console.log('out of ammo')
        }
        
        this.magazine--

        this.updateWeaponStats()
        for (let i = 0; i < 20; i++) {
          this.createBullet()
        }
      } else if (this.magazine === 0 && this.controls.isLocked && e.button === 0){
        if(!this.isReloading){
          this.reload(2)
        }
      }
    } 
    
    this.canvas.parentNode.addEventListener('mousedown', this.fire)

  }

  activateShooting = () => {
    this.isReloading = false
    this.canvas.parentNode.addEventListener('mousedown', this.fire)
    this.canvas.parentNode.addEventListener('mouseup', (e) => {
      if (this.player.class === 1 && e.button === 0){
        clearInterval(this.rapidfire)
      }
    })
  }



  updateBulletPositions = (deltaTime) => {
    this.bullets = this.bullets.filter(element => {
      return element !== null
    })
    for(let i = 0; i < this.bullets.length; i++) { 
      const bulletDisplacement = new THREE.Vector3().copy(this.bullets[i].direction)
      bulletDisplacement.multiplyScalar(deltaTime * this.bullets[i].speed)
      

      this.raycaster.set(this.bullets[i].position, this.bullets[i].direction)
      const intersects = this.raycaster.intersectObjects(this.shootableObjects)
      this.bullets[i].position.add(bulletDisplacement)

      let nearestObject
      if(intersects.length > 0) {
        nearestObject =  intersects[0]
        if(nearestObject.object.isTarget && nearestObject.distance <= bulletDisplacement.length() * 1.5 && this.players[nearestObject.object.playerID].inGame) {
          console.log('bop')
          if (this.bullets[i].shooter === this.socket.id) { 
            this.hitPlayer(nearestObject.object.playerID, this.bullets[i], nearestObject.point)
            if( this.player.class !== 3) {
              this.bullets[i].mesh.geometry.dispose()
              this.bullets[i].mesh.material.dispose()
              this.scene.remove(this.bullets[i].mesh)
              this.bullets[i].mesh = null
              this.bullets[i] = null
            }
          }
        } else if (nearestObject.distance <= bulletDisplacement.length() * 1.3) {
          this.bullets[i].mesh.geometry.dispose()
          this.bullets[i].mesh.material.dispose()
          this.scene.remove(this.bullets[i].mesh)
          this.bullets[i].mesh = null
          this.bullets[i] = null
        }
      }
      if (this.bullets[i]) {  
        if( this.bullets[i].position.distanceToSquared(new THREE.Vector3(0, 0, 0)) >= 10000) {
          this.bullets[i].mesh.geometry.dispose()
          this.bullets[i].mesh.material.dispose()
          this.scene.remove(this.bullets[i].mesh)
          this.bullets[i].mesh = null
          this.bullets[i] = null
        }
      }
      if(this.bullets[i] && !this.bullets[i].mesh) {
        this.bullets[i] = null
      }

    }
    
    

  }

  wasHitFor = (damage) => {
    this.player.health = Math.max(this.player.health - damage, 0)
    if(this.player.health === 0) {
      return
    }

    this.ui.healthBar.shadow.style.width = `${damage * 2.5}px`
    
    setTimeout(() => {
      let temp = this.ui.healthBar.shadow.style.width.substring(0,  this.ui.healthBar.shadow.style.width.length-2)
      this.ui.healthBar.shadow.style.width = `${temp - damage * 2.5}px` 
      temp = this.ui.healthBar.bar.style.width.substring(0, this.ui.healthBar.bar.style.width.length-1)
      this.ui.healthBar.bar.style.width = this.player.health * 0.75 +  '%'
    }, 500)

    if(this.safetyTimeout) {
      clearTimeout(this.safetyTimeout)
    }
    this.isSafe = false
    this.safetyTimeout = setTimeout(() => {
      this.isSafe = true
    }, 5000)

    if(this.player.health < 40) {
      this.ui.healthBar.bar.style.background = '#ff8f8f'
    }
    if(this.player.health < 20) {
      this.ui.healthBar.bar.style.background = '#f00'
    }
  }

  startTick = () => {
    this.requestAnimId.tick = requestAnimationFrame(this.startTick)
    this.tick()
  }
  
  startAnimation = () => {
    this.requestAnimId.other = requestAnimationFrame(this.startAnimation)
    this.inGameTick()
  }

  stopAnimation = () => {
    //this.renderer.clear()
    cancelAnimationFrame(this.requestAnimId.other)
  }

  initScene = () => {
    this.canvas = document.querySelector('canvas.webgl')
    this.canvas.setScale = (scale) => {
      if(scale === 1) {
        this.canvas.style.paddingLeft = '0'
        this.canvasPadding = 0
      }
      if (scale === 2) { 
        this.canvas.style.paddingLeft = '300px'
        this.canvasPadding = 300
      }
      this.resize()
    }

    this.scene = new THREE.Scene()
    // this.gui = new dat.GUI()
    // this.gui.hide()
    this.clock = new THREE.Clock()

    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.001, 
      1000
    )

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias : true,
      powerPreference: 'high-performance'
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.autoClear = false
    
    window.addEventListener('resize', () => {
      this.resize()
    })
  }
  
  resize = () => {
    const width = window.innerWidth -this.canvasPadding
    const height = window.innerHeight

    // Update camera
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
      
    //Update guiCamera
    this.guiCamera = new THREE.OrthographicCamera( width , - width , height , - height , 0.1 , 100 )
    this.guiCamera.lookAt( 0 , -1 , 0 )
      
    // Update renderer
    this.renderer.setSize( width , height )
    this.renderer.setPixelRatio(Math.min( window.devicePixelRatio , 2 ))
  }

  initGui = () => {
    this.guiScene = new THREE.Scene()

    this.guiCamera = new THREE.OrthographicCamera( window.innerWidth , - window.innerWidth , window.innerHeight, - window.innerHeight , 0.1 , 100 )
    this.guiScene.add( this.guiCamera )
    this.guiCamera.position.y += 1
    this.guiCamera.lookAt( 0 , -1 , 0 )

    const crosshairMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const meshR = new THREE.Mesh(new THREE.BoxGeometry( 20 , 0.5 , 3 ), crosshairMaterial)
    this.guiScene.add( meshR )
    meshR.position.x = - 12.5
    const meshL = new THREE.Mesh(new THREE.BoxGeometry( 20 , 0.5 , 3 ), crosshairMaterial)
    this.guiScene.add( meshL )
    meshL.position.x = 12.5
    const meshB = new THREE.Mesh(new THREE.BoxGeometry( 3 , 0.5 , 20 ), crosshairMaterial)
    this.guiScene.add( meshB )
    meshB.position.z = 12.5
    const meshT = new THREE.Mesh(new THREE.BoxGeometry( 3 , 0.5 , 20 ), crosshairMaterial)
    this.guiScene.add( meshT )
    meshT.position.z = - 12.5
    this.guiCamera.lookAt( 0 , 0 , 0 ) 

    this.ui.crosshair = {
      right: meshR,
      left: meshL,
      top: meshT,
      bottom: meshB,
      width: 3
    }
  }

  updateCrosshair = (deltaTime) => {
    let max = 0 //35

    if(this.player.class === 1) {
      let speed = 50
      this.bloom = 0.015
      if (this.moveForward && !this.moveBackward || this.moveBackward && !this.moveForward || this.moveRight && !this.moveLeft || this.moveLeft && !this.moveRight) {
          max = 35
          this.bloom = 0.05
      }
      if (this.isJumping ) {
          max = 50
          speed = 75
          this.bloom = 0.1
      }
      if(max !== 0) {
        this.ui.crosshair.top.position.z = Math.max(this.ui.crosshair.top.position.z - deltaTime * 3 * speed, -1 * max)
        this.ui.crosshair.bottom.position.z = Math.min(this.ui.crosshair.bottom.position.z + deltaTime * 3 * speed, max)
        this.ui.crosshair.left.position.x = Math.min(this.ui.crosshair.left.position.x + deltaTime * 3 * speed, max)
        this.ui.crosshair.right.position.x = Math.max(this.ui.crosshair.right.position.x - deltaTime * 3 * speed, - max)
      }
      if (this.ui.crosshair.top.position.z < -17.5) {
        this.ui.crosshair.top.position.z = Math.min(this.ui.crosshair.top.position.z + deltaTime * speed , -17.5)
        this.ui.crosshair.bottom.position.z = Math.max(this.ui.crosshair.bottom.position.z - deltaTime * speed , 17.5)
        this.ui.crosshair.left.position.x = Math.max(this.ui.crosshair.left.position.x - deltaTime * speed , 17.5)
        this.ui.crosshair.right.position.x = Math.min(this.ui.crosshair.right.position.x + deltaTime * speed , - 17.5)
      }
    }

    if(this.player.class === 3) {
      let speed = 50
      let maxbloom = 0
      if(this.mouseMoving) {
        speed = 10
        max = 75
        maxbloom = 0.15
      }
      if (this.moveForward && !this.moveBackward || this.moveBackward && !this.moveForward || this.moveRight && !this.moveLeft || this.moveLeft && !this.moveRight) {
        speed = 75
        max = 75
        maxbloom = 0.15
      }
      if (this.isJumping ) {
        max = 100
        speed = 100
        maxbloom = 0.24
      }
      if(max !== 0) {
        this.ui.crosshair.top.position.z = Math.max(this.ui.crosshair.top.position.z - deltaTime * 3 * speed, -1 * max)
        this.ui.crosshair.bottom.position.z = Math.min(this.ui.crosshair.bottom.position.z + deltaTime * 3 * speed, max)
        this.ui.crosshair.left.position.x = Math.min(this.ui.crosshair.left.position.x + deltaTime * 3 * speed, max)
        this.ui.crosshair.right.position.x = Math.max(this.ui.crosshair.right.position.x - deltaTime * 3 * speed, - max)
      }
      if (this.ui.crosshair.top.position.z < -12.5) {
        this.ui.crosshair.top.position.z = Math.min(this.ui.crosshair.top.position.z + deltaTime * speed , -12.5)
        this.ui.crosshair.bottom.position.z = Math.max(this.ui.crosshair.bottom.position.z - deltaTime * speed , 12.5)
        this.ui.crosshair.left.position.x = Math.max(this.ui.crosshair.left.position.x - deltaTime * speed , 12.5)
        this.ui.crosshair.right.position.x = Math.min(this.ui.crosshair.right.position.x + deltaTime * speed , - 12.5)
      }
      this.bloom =  - 0.0024 * (this.ui.crosshair.top.position.z + 12.5)
    }
  }

  setCrosshairWidth = (width) => {
    //this.ui.crosshair.top.scale.x = width
    //this.ui.crosshair.bottom.scale.x = width
    this.ui.crosshair.left.scale.z = width
    this.ui.crosshair.right.scale.z = width
  }

  updateUI = (deltaTime) => {
    this.updateCrosshair(deltaTime)
    this.updateHealth(deltaTime)
  }

  updateHealth = (deltaTime) => {
    if(this.isSafe) {
      this.player.health = Math.min( this.player.health + deltaTime * 17.5, 100)
      this.ui.healthBar.shadow.style.width = `${Math.min(2.5 * (100 -this.player.health), 10)}px`
      this.ui.healthBar.bar.style.width = 0.75 * this.player.health + '%'
      if(this.player.health > 20) {
        this.ui.healthBar.bar.style.background = '#ff8f8f'
      }
      if(this.player.health > 40) {
        this.ui.healthBar.bar.style.background = '#1ce490'
      }
    }
  }

  updateWeaponStats = () => {
    let max
    switch (this.player.class) {
      case 1:
        max = 20
        break
      case 2:
        max = 2
        break
      case 3:
        max = 5
        break
    }
    this.ui.weaponStats.ammoCount.textContent = `${this.magazine } / ${max}`
  }

  initMap = () => {
    this.collidableObjects = []
    this.shootableObjects = []

    //build lights
    const ambientLight = new THREE.AmbientLight( 0xffffff , 10 )
    this.scene.add(ambientLight)

    const hemisphereLight = new THREE.HemisphereLight( 0xffffbb, 0x080820, 1 )
    this.scene.add( hemisphereLight )

    const pointLight = new THREE.PointLight( 0xffffff , 1000 )
    pointLight.position.set( 10 , 10 , 10 )
    this.scene.add( pointLight )

    //build meshes
    const boxMaterial = new THREE.MeshPhongMaterial({ color: 0x2f2f5f })
    this.createBox( 1 , 1 , 1 , 0 , 2 , 0 , boxMaterial )
    this.createBox( 1 , 1 , 1 , 2 , 4 , 1 , boxMaterial )
    this.createBox( 1 , 1 , 1 , 3 , 6 , 2 , boxMaterial )
    this.createBox( 1 , 1 , 1 , 5 , 7 , 4 , boxMaterial )
    this.createBox( 10 , 10 , 10 , 15 , 5 , 20 , boxMaterial )

    const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x5f5f5f })
    const floorPlane = this.createBox(50, 5, 50, 0, -2.5 , 0, planeMaterial)

  }

  createBox = (l, h , w, x, y, z, material) => {
    const boxGeometry = new THREE.BoxGeometry(l, h, w)
    const boxMesh = new THREE.Mesh(boxGeometry, material)
    boxMesh.position.set(x, y, z)
    this.scene.add(boxMesh)
    boxMesh.isTarget = false
    this.collidableObjects.push({
      object: boxMesh,
      x: l/2,
      y: h/2,
      z: w/2,
    })
    this.shootableObjects.push(boxMesh)
    return boxMesh
  }

  createCrate = () => {

  }

  initSkybox() {
    this.scene.background = new THREE.CubeTextureLoader().load([
      './textures/Right_Tex.webp',
      './textures/Left_Tex.webp',
      './textures/Up_Tex.webp',
      './textures/Down_Tex.webp',
      './textures/Front_Tex.webp',
      './textures/Back_Tex.webp',
    ])

  }


  initPlayer = () => {
    this.velocity = new THREE.Vector3()
    this.direction = new THREE.Vector3()

    this.player = {
      width: 0.5,
      height: 2,
      speed: 50,
      jump: 15,
      feet: null,
      body: null,
      id: null,
      username: null,
      score: 0,
      inGame: false,
      class: 1,
      health: 100
    }

    

    const feetGeometry = new THREE.BoxGeometry(this.player.width * 2, 0.01, this.player.width * 2)
    const bodyGeometry = new THREE.BoxGeometry(this.player.width * 2 , this.player.width * 2 , this.player.width * 2)
    const characterMaterial = new THREE.MeshNormalMaterial()//({ color: 0xff1f1f, side: THREE.DoubleSide})
    this.player.feet = new THREE.Mesh(feetGeometry, characterMaterial)
    this.scene.add(this.player.feet)
    this.player.body = new THREE.Mesh(bodyGeometry, characterMaterial)
    this.scene.add(this.player.body)

    const gunGeometry = new THREE.BoxGeometry(0.1,0.2,0.75)
    const gunMaterial = new THREE.MeshLambertMaterial({color: 0xff1f1f})
    const gun = new THREE.Mesh(gunGeometry, gunMaterial)

    this.camera.add(gun)


    // this.scene.add(this.loadedScar)
    // this.loadedScar.scale.set(.0002, .0002, .0002)
    // this.loadedScar.position.set(0,3.75-4.5,0)
    // this.loadedScar.rotation.y = - Math.PI / 2    
    
    
    // this.loadedScar.rotation.z = - Math.PI/18
    // this.loadedScar.rotation.y = - Math.PI/32
    // this.loadedScar.position.set(2,-1,10)
    // this.loadedScar.scale.set(.001, .001, .001)
    // this.camera.add(this.loadedScar)
    this.gun = this.camera.children[0]
    this.gun.position.set(0.1,-0.3,-0.5)

    this.player.feet.position.y -- 
    this.player.body.position.y -= 3 //hide player
  }

  initStats = () => {
    //fps
    this.stats = new Stats()
    this.stats.showPanel( 0 )
    
    //Leaderboard
    this.leaderboardArray = []

  }

  initControls = () => {
    this.controls = new PointerLockControls(this.camera, this.canvas)
    this.controls.minPolarAngle = 0.0001
    this.controls.maxPolarAngle = 0.9999 * Math.PI

    this.moveForward = false
    this.moveBackward = false
    this.moveLeft = false
    this.moveRight = false
    this.isJumping = false
    // this.moveUp = false
    // this.moveDown = false

    this.canvas.parentNode.addEventListener("click" , (e) => {
      if(this.inputsDisabled) {
        e.stopPropagation()
        e.preventDefault()
        document.exitPointerLock()
      }
    })
    document.addEventListener("mousedown", this.scopeIn)
    document.addEventListener("mouseup", this.scopeOut)
  }

  scopeIn = (e) => {
    if (this.player.inGame && this.player.class === 3 && e.button === 2) {
      this.enterSniperScope()
    }
  }

  scopeOut = (e) => {
    if (this.player.inGame && this.player.class === 3 && e.button === 2) {
      this.exitSniperScope()
    }
  }

  enterSniperScope = () => {
    this.isScoped = true

    this.setCrosshairWidth(2.2)

    this.player.speed /= 3
    this.controls.pointerSpeed = 0.25

    console.log(this.gun.position)
    this.gun.position.set(0,0,0)

    let i = 0
    const loop = (i) => {
      setTimeout(() => {
        this.camera.fov -= 1.5
        this.camera.updateProjectionMatrix()
      }, i / 4)
    }
    while (i < 500) {
      loop(i)
      i+=25
    }

    this.camera.updateProjectionMatrix()
    this.ui.scope.style.display = 'block'
  }

  exitSniperScope = () => {
    this.camera.fov = 75
    this.gun.position.set(0.1, -0.3, -0.5)
    this.setCrosshairWidth(1)
    this.player.speed *=3
    this.controls.pointerSpeed = 1
    this.isScoped = false
    this.camera.updateProjectionMatrix()
    this.ui.scope.style.display = 'none'
  }


  initCombat = () => {
    this.raycaster = new THREE.Raycaster()
    this.cooldown = 0

    this.tracerRaycaster = new THREE.Raycaster()

    this.killArrow = null
    this.bullets = []

    let mouseTimeout, oldX, oldY, oldZ, oldTime
    this.canvas.parentNode.addEventListener('mousemove', (e)=> {

      if (oldTime === null) {
        oldTime = this.clock.getElapsedTime();
        oldX = this.camera.rotation.x
        oldX = this.camera.rotation.y
        oldX = this.camera.rotation.z
      }

      let now = this.clock.getElapsedTime()
      let dt =  now - oldTime
      let dx = this.camera.rotation.x - oldX
      let dy = this.camera.rotation.y - oldY
      let dz = this.camera.rotation.z - oldZ
      let speedSquared = dx * dx / dt / dt  + dy * dy / dt / dt + dz * dz / dt / dt

      oldTime = now
      oldX = this.camera.rotation.x
      oldY = this.camera.rotation.y
      oldZ = this.camera.rotation.z

      if (speedSquared > 500) {  
        clearTimeout(mouseTimeout)
        this.mouseMoving = true
        mouseTimeout = setTimeout(() => {
          this.mouseMoving = false
        }, 1000/5)
      }
    })

    this.svgNums = {
      default: `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="100px" height="49px" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd" xmlns:xlink="http://www.w3.org/1999/xlink"><g>`,
      saved: {}
    }
    this.svgNums[0] = {width:  29, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 8.5,-0.5 C 12.1667,-0.5 15.8333,-0.5 19.5,-0.5C 24.4359,2.03465 27.4359,6.03465 28.5,11.5C 28.5,19.1667 28.5,26.8333 28.5,34.5C 27.0012,39.6603 24.0012,43.6603 19.5,46.5C 15.8333,46.5 12.1667,46.5 8.5,46.5C 3.7587,43.3439 0.758695,39.0106 -0.5,33.5C -0.5,26.1667 -0.5,18.8333 -0.5,11.5C 0.989077,6.34718 3.98908,2.34718 8.5,-0.5 Z M 12.5,9.5 C 14.4831,14.5496 15.4831,20.0496 15.5,26C 15.5185,29.639 14.8518,33.139 13.5,36.5C 11.9499,32.7012 11.2832,28.7012 11.5,24.5C 11.7229,19.4856 12.0563,14.4856 12.5,9.5 Z"/><g></g>`}
    this.svgNums[1] = {width:  21, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 13.5,-0.5 C 14.5,-0.5 15.5,-0.5 16.5,-0.5C 17.5676,0.434475 18.901,0.767809 20.5,0.5C 20.5,15.5 20.5,30.5 20.5,45.5C 16.5,45.5 12.5,45.5 8.5,45.5C 8.83175,35.8104 8.49842,26.1437 7.5,16.5C 6.16667,17.1667 4.83333,17.8333 3.5,18.5C 2.15581,15.072 0.822473,11.7387 -0.5,8.5C -0.5,7.83333 -0.5,7.16667 -0.5,6.5C 4.23199,4.134 8.89866,1.80067 13.5,-0.5 Z"/><g></g>`}
    this.svgNums[2] = {width:  30, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 11.5,-0.5 C 14.5,-0.5 17.5,-0.5 20.5,-0.5C 24.7425,0.741084 27.7425,3.40775 29.5,7.5C 29.5,11.8333 29.5,16.1667 29.5,20.5C 26.9085,25.8344 23.2418,30.3344 18.5,34C 21.4816,34.498 24.4816,34.6646 27.5,34.5C 27.5,38.1667 27.5,41.8333 27.5,45.5C 19.1667,45.5 10.8333,45.5 2.5,45.5C 2.33418,40.8215 2.50085,36.1548 3,31.5C 7.41585,29.0883 11.2492,25.9217 14.5,22C 10.0182,22.0631 5.85151,21.2297 2,19.5C 0.169579,10.1676 3.33625,3.50097 11.5,-0.5 Z M 15.5,10.5 C 17.4491,13.6064 17.2824,16.9397 15,20.5C 13.4825,17.1487 13.6492,13.8153 15.5,10.5 Z"/><g></g>`}
    this.svgNums[3] = {width:  30, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 11.5,-0.5 C 14.5,-0.5 17.5,-0.5 20.5,-0.5C 24.4195,1.08358 27.4195,3.75025 29.5,7.5C 29.5,11.1667 29.5,14.8333 29.5,18.5C 28.2206,20.1233 26.8872,21.79 25.5,23.5C 26.8872,25.21 28.2206,26.8767 29.5,28.5C 29.5,32.5 29.5,36.5 29.5,40.5C 27.8333,44.1667 25.1667,46.8333 21.5,48.5C 17.5,48.5 13.5,48.5 9.5,48.5C 1.93947,44.3387 -0.393868,38.0054 2.5,29.5C 6.44522,30.2685 10.4452,30.7685 14.5,31C 13.1337,33.3818 13.467,35.5485 15.5,37.5C 17.9383,35.3439 18.105,33.0106 16,30.5C 14.3005,29.5939 12.4672,29.2606 10.5,29.5C 10.5,26.1667 10.5,22.8333 10.5,19.5C 12.099,19.7678 13.4324,19.4345 14.5,18.5C 10.1667,18.5 5.83333,18.5 1.5,18.5C -0.0871487,9.33158 3.24618,2.99825 11.5,-0.5 Z M 14.5,18.5 C 13.4217,15.8013 13.755,13.1347 15.5,10.5C 15.8333,11.8333 16.1667,13.1667 16.5,14.5C 16.4146,16.3328 15.7479,17.6661 14.5,18.5 Z"/><g></g>`}
    this.svgNums[4] = {width:  29, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 8.5,-0.5 C 14.1667,-0.5 19.8333,-0.5 25.5,-0.5C 25.5,8.5 25.5,17.5 25.5,26.5C 26.5,26.5 27.5,26.5 28.5,26.5C 28.5,29.8333 28.5,33.1667 28.5,36.5C 27.5,36.5 26.5,36.5 25.5,36.5C 25.5,39.1667 25.5,41.8333 25.5,44.5C 21.5,44.5 17.5,44.5 13.5,44.5C 13.5,42.1667 13.5,39.8333 13.5,37.5C 8.83333,37.5 4.16667,37.5 -0.5,37.5C -0.5,32.8333 -0.5,28.1667 -0.5,23.5C 2.47944,15.5702 5.47944,7.57024 8.5,-0.5 Z M 12.5,15.5 C 13.4816,18.9619 13.815,22.6286 13.5,26.5C 12.5,26.5 11.5,26.5 10.5,26.5C 11.1667,22.8333 11.8333,19.1667 12.5,15.5 Z"/><g></g>`}
    this.svgNums[5] = {width:  29, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 1.5,-0.5 C 10.1667,-0.5 18.8333,-0.5 27.5,-0.5C 27.5,3.16667 27.5,6.83333 27.5,10.5C 22.5,10.5 17.5,10.5 12.5,10.5C 12.3433,11.8734 12.51,13.2068 13,14.5C 17.0524,12.0577 21.2191,11.891 25.5,14C 26.6087,15.8761 27.6087,17.7095 28.5,19.5C 28.5,25.1667 28.5,30.8333 28.5,36.5C 26.4748,40.5253 23.4748,43.5253 19.5,45.5C 16.1667,45.5 12.8333,45.5 9.5,45.5C 2.19968,42.3547 -0.800323,36.688 0.5,28.5C 4.51383,28.3345 8.51383,28.5012 12.5,29C 13.8205,37.6264 15.1538,37.6264 16.5,29C 16.2191,26.7084 15.5524,24.5417 14.5,22.5C 13.7564,23.9905 13.0897,25.4905 12.5,27C 8.81246,27.4501 5.1458,27.2834 1.5,26.5C 1.5,17.5 1.5,8.5 1.5,-0.5 Z"/><g></g>`}
    this.svgNums[6] = {width:  28, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 10.5,-0.5 C 13.5,-0.5 16.5,-0.5 19.5,-0.5C 23.1667,1.16667 25.8333,3.83333 27.5,7.5C 27.5,9.83333 27.5,12.1667 27.5,14.5C 23.4862,14.6655 19.4862,14.4988 15.5,14C 14.7734,12.6012 14.2734,11.1012 14,9.5C 12.388,11.9481 11.7213,14.6148 12,17.5C 15.2559,15.5715 18.7559,15.0715 22.5,16C 24.749,17.3516 26.4156,19.1849 27.5,21.5C 27.5,26.5 27.5,31.5 27.5,36.5C 25.8333,41.5 22.5,44.8333 17.5,46.5C 14.8333,46.5 12.1667,46.5 9.5,46.5C 4.34513,44.0123 1.0118,40.0123 -0.5,34.5C -0.5,27.1667 -0.5,19.8333 -0.5,12.5C 0.650928,6.01731 4.31759,1.68398 10.5,-0.5 Z M 11.5,25.5 C 12.5,25.5 13.5,25.5 14.5,25.5C 15.5986,28.8438 15.2652,32.1771 13.5,35.5C 12.1921,32.2937 11.5254,28.9604 11.5,25.5 Z"/><g></g>`}
    this.svgNums[7] = {width:  23, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M -0.5,-0.5 C 7.16667,-0.5 14.8333,-0.5 22.5,-0.5C 22.5,4.5 22.5,9.5 22.5,14.5C 20.3445,17.4374 18.8445,20.7708 18,24.5C 17.0553,31.8724 16.222,39.2057 15.5,46.5C 11.5,46.5 7.5,46.5 3.5,46.5C 2.61429,34.4745 4.94762,23.1412 10.5,12.5C 6.89272,11.5108 3.22605,11.1774 -0.5,11.5C -0.5,7.5 -0.5,3.5 -0.5,-0.5 Z"/><g></g>`}
    this.svgNums[8] = {width:  31, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 10.5,-0.5 C 13.5,-0.5 16.5,-0.5 19.5,-0.5C 27.6518,3.15342 30.4851,9.48676 28,18.5C 27.028,20.3049 25.8613,21.9716 24.5,23.5C 27.4159,26.0471 29.4159,29.0471 30.5,32.5C 30.5,33.5 30.5,34.5 30.5,35.5C 29.7947,41.2072 26.7947,45.2072 21.5,47.5C 16.8333,47.5 12.1667,47.5 7.5,47.5C 4.21573,45.883 1.54906,43.5497 -0.5,40.5C -0.5,36.5 -0.5,32.5 -0.5,28.5C 1.29585,27.2073 2.96252,25.7073 4.5,24C 0.715924,19.139 -0.450743,13.639 1,7.5C 2.95208,3.28927 6.11875,0.6226 10.5,-0.5 Z M 13.5,9.5 C 15.4387,10.0138 16.4387,11.3472 16.5,13.5C 15.319,19.8889 13.9857,19.7223 12.5,13C 12.9891,11.8615 13.3225,10.6948 13.5,9.5 Z M 13.5,29.5 C 15.0428,30.7358 16.0428,32.4024 16.5,34.5C 14.8333,38.5 13.1667,38.5 11.5,34.5C 12.1744,32.8045 12.8411,31.1379 13.5,29.5 Z"/><g></g>`}
    this.svgNums[9] = {width:  29, code: `<path transform="translate(123456789,0)" style="opacity:1" fill="#26ff16" d="M 9.5,-0.5 C 12.5,-0.5 15.5,-0.5 18.5,-0.5C 24.0032,2.17672 27.3365,6.51005 28.5,12.5C 28.5,20.5 28.5,28.5 28.5,36.5C 27.0012,41.6603 24.0012,45.6603 19.5,48.5C 15.5,48.5 11.5,48.5 7.5,48.5C 1.67169,44.0387 -0.66164,38.0387 0.5,30.5C 4.8766,30.5775 9.20993,31.0775 13.5,32C 12.228,34.0445 12.5614,35.8778 14.5,37.5C 15.9092,34.8355 16.2425,32.1688 15.5,29.5C 8.45127,31.6546 3.61793,29.3213 1,22.5C -1.95793,12.4005 0.875401,4.73386 9.5,-0.5 Z M 13.5,9.5 C 14.1174,9.61071 14.6174,9.94404 15,10.5C 15.7189,14.1454 16.2189,17.8121 16.5,21.5C 15.5,21.5 14.5,21.5 13.5,21.5C 12.1667,17.5 12.1667,13.5 13.5,9.5 Z"/><g></g>`}
    this.svgNums[100] = `<path  style="opacity:0.96" fill="#26ff16" d="M 13.5,-0.5 C 14.5,-0.5 15.5,-0.5 16.5,-0.5C 17.5676,0.434475 18.901,0.767809 20.5,0.5C 20.5,15.5 20.5,30.5 20.5,45.5C 16.5,45.5 12.5,45.5 8.5,45.5C 8.83175,35.8104 8.49842,26.1437 7.5,16.5C 6.16667,17.1667 4.83333,17.8333 3.5,18.5C 2.15581,15.072 0.822473,11.7387 -0.5,8.5C -0.5,7.83333 -0.5,7.16667 -0.5,6.5C 4.23199,4.134 8.89866,1.80067 13.5,-0.5 Z"/><path transform="translate(22,0)" style="opacity:0.932" fill="#26ff16" d="M 8.5,-0.5 C 12.1667,-0.5 15.8333,-0.5 19.5,-0.5C 24.4359,2.03465 27.4359,6.03465 28.5,11.5C 28.5,19.1667 28.5,26.8333 28.5,34.5C 27.0012,39.6603 24.0012,43.6603 19.5,46.5C 15.8333,46.5 12.1667,46.5 8.5,46.5C 3.7587,43.3439 0.758695,39.0106 -0.5,33.5C -0.5,26.1667 -0.5,18.8333 -0.5,11.5C 0.989077,6.34718 3.98908,2.34718 8.5,-0.5 Z M 12.5,9.5 C 14.4831,14.5496 15.4831,20.0496 15.5,26C 15.5185,29.639 14.8518,33.139 13.5,36.5C 11.9499,32.7012 11.2832,28.7012 11.5,24.5C 11.7229,19.4856 12.0563,14.4856 12.5,9.5 Z"/><path transform="translate(53,0)" style="opacity:0.932" fill="#26ff16" d="M 8.5,-0.5 C 12.1667,-0.5 15.8333,-0.5 19.5,-0.5C 24.4359,2.03465 27.4359,6.03465 28.5,11.5C 28.5,19.1667 28.5,26.8333 28.5,34.5C 27.0012,39.6603 24.0012,43.6603 19.5,46.5C 15.8333,46.5 12.1667,46.5 8.5,46.5C 3.7587,43.3439 0.758695,39.0106 -0.5,33.5C -0.5,26.1667 -0.5,18.8333 -0.5,11.5C 0.989077,6.34718 3.98908,2.34718 8.5,-0.5 Z M 12.5,9.5 C 14.4831,14.5496 15.4831,20.0496 15.5,26C 15.5185,29.639 14.8518,33.139 13.5,36.5C 11.9499,32.7012 11.2832,28.7012 11.5,24.5C 11.7229,19.4856 12.0563,14.4856 12.5,9.5 Z"/>`
  
  }



  cloneGltf = (gltf) => { ///////////////////////////////////////////////////////////////////////////////////////from github
    const clone = {
      animations: gltf.animations,
      scene: gltf.scene.clone(true)
    };
  
    const skinnedMeshes = {};
  
    gltf.scene.traverse(node => {
      if (node.isSkinnedMesh) {
        skinnedMeshes[node.name] = node;
      }
    });
  
    const cloneBones = {};
    const cloneSkinnedMeshes = {};
  
    clone.scene.traverse(node => {
      if (node.isBone) {
        cloneBones[node.name] = node;
      }
  
      if (node.isSkinnedMesh) {
        cloneSkinnedMeshes[node.name] = node;
      }
    });
  
    for (let name in skinnedMeshes) {
      const skinnedMesh = skinnedMeshes[name];
      const skeleton = skinnedMesh.skeleton;
      const cloneSkinnedMesh = cloneSkinnedMeshes[name];
  
      const orderedCloneBones = [];
  
      for (let i = 0; i < skeleton.bones.length; ++i) {
        const cloneBone = cloneBones[skeleton.bones[i].name];
        orderedCloneBones.push(cloneBone);
      }
  
      cloneSkinnedMesh.bind(
          new THREE.Skeleton(orderedCloneBones, skeleton.boneInverses),
          cloneSkinnedMesh.matrixWorld);
    }
  
    return clone;
  }                        /////////////////////////////////////////////////////////////////////////////////////////////////////



  initModels = () => {
    const loader = new GLTFLoader(this.loadingManager)
    this.models = {}
    loader.load( './models/Soldier-smoothattempt.glb', ( gltf ) => {
      this.models.soldierGltf = gltf
    } )
    loader.load( './models/cargoBlue.glb', ( gltf ) => {
      this.models.cargoB = gltf.scene
      gltf.scene.scale.set(1.75,1.75,1.75)
    } )
    loader.load( './models/cargoRed.glb', ( gltf ) => {
      this.models.cargoR = gltf.scene
    } )
    loader.load( './models/cargoGreen.glb', ( gltf ) => {
      this.models.cargoG = gltf.scene
    } )
    loader.load( './models/cargoLightGrey.glb', ( gltf ) => {
      this.models.cargoLG = gltf.scene
    } )
    return new Promise((resolve) => {
      this.loadingManager.onLoad = () => {
        console.log('Loaded Model!')
        setTimeout(() => {
          this.ui.loadingBar.classList.add('ended')
          this.ui.loadingBar.style.transform = ''
        }, 450)
        setTimeout(() => {
          document.getElementById('loading-bar-top').style.height = '0'
          document.getElementById('loading-bar-top').style.animation = '2s slideUpDownOut linear 1'
          document.getElementById('loading-bar-bottom').style.height = '0'
          document.getElementById('loading-bar-bottom').style.animation = '2s slideUpDownOut linear 1'
        }, 2300)
        
        resolve()
      }
    })
  }

  initSocket = () => {
    this.socket = io()

    this.socket.on('connect', () => {
      console.log('connect')
      this.sendUsername()
    })

    this.socket.on('initPlayer', (id, playerCount, playerIDs, players) => {
      console.log('init player')
      this.player.id = id
      for (let i = 0; i < playerCount; i++) {
        if (playerIDs[i] != this.player.id) {
          this.initOtherPlayer(
            playerIDs[i], 
            players[playerIDs[i]].username, 
            players[playerIDs[i]].score, 
            players[playerIDs[i]].inGame,
            players[playerIDs[i]].health
          )
        }
      }
      this.fillLeaderboardArray()
      this.updateLeaderboard()
    })

    this.socket.on('positions', (players) => {
        this.updateOtherPlayerStats(players)
    })

    this.socket.on('playerConnected', (playerID, username, playerCount) => {
      console.log('player connected')
      if (playerID != this.player.id) {
        this.initOtherPlayer(playerID, username, 0, false, 100)
      }
      this.leaderboardArray[this.leaderboardArray.length] = this.players[playerID]
      this.updateLeaderboard()
    })

    this.socket.on('playerDisconnected', (playerID, playerCount) => {
      console.log('player disconnected')
      this.deleteOtherPlayer(playerID)
    })

    this.socket.on('playerHit', (shooterID, shotID, bullet, point) => {
      if(this.player.id === shotID) {
        this.wasHitFor(bullet.damage)
        if(this.player.health === 0) {
          this.players[shooterID].score++
          if(this.player.inGame) {
            this.wasKilled(shooterID)
          }
          this.addKillArrow(point, bullet.startPosition)
        }
      }
    })

    this.socket.on('playerKilled', (killerID, killedID) => {
      console.log(killedID + ' was killed by ' + killerID)
      this.scene.remove(this.players[killedID].feet)
      this.scene.remove(this.players[killedID].body)
      this.scene.remove(this.players[killedID].gun)
      this.players[killedID].inGame = false

      if (this.player.id === killerID) {
        this.player.score++
        this.addOwnKillMessage(killedID)
      } else if (this.players[killerID]) {
        this.players[killerID].score++
        this.addKillMessage(killerID, killedID)
      }
      this.players[killedID].score = 0

      this.updateLeaderboard()
    })

    this.socket.on('spawn', (playerID) => {
      console.log(playerID + '  spawned')
      this.scene.add(this.players[playerID].body)
      this.players[playerID].inGame = true
      this.updateLeaderboard()
    })


    this.socket.on('shoot', (bullet) => {
      const bulletPosition = new Float32Array([
        0, 0, 0
      ])
      const bulletMaterial = new THREE.PointsMaterial({
        size: 0.04,
        sizeAttenuation: true
      })
      const bulletGeometry = new THREE.BufferGeometry()
      bulletGeometry.setAttribute('position', new THREE.BufferAttribute(bulletPosition, 3))
      let bulletMesh = new THREE.Points(bulletGeometry, bulletMaterial)
      bulletMesh.position.copy(new THREE.Vector3().fromArray(bullet.position))
      this.scene.add(bulletMesh)

      const direction = new THREE.Vector3().fromArray(bullet.direction)

      this.bullets.push({
        direction: direction,
        position: bulletMesh.position,
        shooter: bullet.shooter,
        speed: bullet.speed,
        startPosition: bullet.position,
        mesh: bulletMesh,
      })
      setTimeout(() => {
        if(bulletMesh != null){          bulletMesh.geometry.dispose()
          bulletMesh.material.dispose()
          this.scene.remove(bulletMesh)
          bulletMesh = null
        }
      }, bullet.time * 1000)
      this.createTracer( bulletMesh.position, direction, bullet.speed)
    })

  }

  addKillArrow = ( point,  killerVector ) => {
    this.scene.remove(this.killArrow)
    const pointVector = new THREE.Vector3().fromArray(point)
    const killVector = new THREE.Vector3().subVectors(pointVector, killerVector)
    const length = killVector.length()
    killVector.normalize()
    this.killArrow = new THREE.ArrowHelper( 
      killVector, 
      killerVector, 
      length, 
      0xff0000
    )
    this.scene.add(this.killArrow)
  }

  setUsername = (username) => {
    this.player.username = username
  }

  sendUsername = () => {
    this.socket.emit('username', this.player.username)
  }

  makeSkeletonCollider = (gltf, playerID) => {
    let material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        depthTest: false,
        visible: false
    })

    
    gltf.traverse((child) => {
        if (child.isBone) {
            if (child.parent && child.parent.type === 'Bone') {
                let geometry, hitBoxElement
                if (!child.name.includes('ik')) {
                  if(child.name === 'head') {
                    geometry = new THREE.SphereGeometry(3.45, 7, 7)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    child.position.copy(hitBoxElement)
                    hitBoxElement.position.y+=3.5
                    hitBoxElement.position.z-=0.3
                  } else if (child.name === 'lower_spine'){
                    geometry = new THREE.BoxGeometry(5,4,2.25)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=1.25
                    hitBoxElement.position.z+=0.3
                    child.position.copy(hitBoxElement)
                  } else if (child.name === 'upper_spine'){
                    geometry = new THREE.BoxGeometry(5,3,2.25)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=2.75
                    child.position.copy(hitBoxElement)
                   } else if (child.name.includes('upper_leg')) {
                    geometry = new THREE.BoxGeometry(1.75,3.7,1.75)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=1.8
                    child.position.copy(hitBoxElement)
                  } else if (child.name.includes('lower_leg')) {
                    geometry = new THREE.BoxGeometry(1.75,3.7,1.75)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=1.8
                    child.position.copy(hitBoxElement)
                  } else if (child.name.includes('foot')) {
                    geometry = new THREE.BoxGeometry(1.75,1,2)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=1.8
                    hitBoxElement.rotation.x =  1.15
                    child.position.copy(hitBoxElement)
                  } else if (child.name.includes('upper_arm') && !child.name.includes('0')) {
                    console.log(child.name)
                    geometry = new THREE.BoxGeometry(1.55,4,1.55)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=1.8
                    child.position.copy(hitBoxElement)
                  } else if (child.name.includes('forearm') ) {
                    console.log(child.name)
                    geometry = new THREE.BoxGeometry(1.2,4.4,1.2)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=2
                    child.position.copy(hitBoxElement)
                  } else if (child.name.includes('hand') ) {
                    console.log(child.name)
                    geometry = new THREE.BoxGeometry(1.2,1.5,1.2)
                    hitBoxElement = new THREE.Mesh(geometry, material)
                    hitBoxElement.position.y+=0.7
                    child.position.copy(hitBoxElement)
                  }
                  if(hitBoxElement) {
                    child.add(hitBoxElement) 
                    hitBoxElement.isTarget = true
                    this.shootableObjects.push(hitBoxElement)
                    hitBoxElement.playerID = playerID
                  }
                }
            }
        }
    })
    
  }

  initOtherPlayer = (playerID, username, score, inGame) => {
    const gltfClone = this.cloneGltf(this.models.soldierGltf)
    const body = gltfClone.scene
    body.scale.set(0.014,0.014,0.014)
    this.makeSkeletonCollider(body, playerID)

    let mixer = new THREE.AnimationMixer(body)

    
    let animations = {
      rotateHeadDownN: "RotateHeadDown.n",
      rotateHeadUpN: "RotateHeadUp.n",
      runningN: "running.n",
      rotateHeadDownNW: "RotateHeadDown.nw",
      rotateHeadUpNW: "RotateHeadUp.nw",
      runningNW: "running.nw",
      rotateHeadDownNE: "RotateHeadDown.ne",
      rotateHeadUpNE: "RotateHeadUp.ne",
      runningNE: "running.ne",
      rotateHeadDownE: "RotateHeadDown.e",
      rotateHeadUpE: "RotateHeadUp.e",
      runningE: "running.e",
      rotateHeadDownW: "RotateHeadDown.w",
      rotateHeadUpW: "RotateHeadUp.w",
      runningW: "running.w",
      runningSW: "running.sw",
      runningSE: "running.se",
      runningS: "running.s",
      rotateHeadDownS: "RotateHeadDown.s",
      rotateHeadUpS: "RotateHeadUp.s",
      idle: "idle",
      idleR: "idle.r",
      rotateHeadUpI: "RotateHeadUp.i",
      rotateHeadDownI: "RotateHeadDown.i",
      jumpI: "idle.j",
    }
    
    
    new Promise (resolve => {
      let i = 0
      for (let clip of gltfClone.animations) {
        for (let key in animations) {
          if (animations[key] === clip.name) {
            if (clip.name.includes('Head') || clip === 'idle.r') {
              console.log('name  ' + clip.name)
              THREE.AnimationUtils.makeClipAdditive(clip)
            } 
            animations[key] = mixer.clipAction(clip)
          }
        }
        i++
        if (i === gltfClone.animations.length) {
          console.log(animations)
          resolve()
        }
      }
    }).then(() => {
      animations.rotateHeadDownN.number = 0
      animations.rotateHeadUpN.number = 0.5
      animations.runningN.number = 0
      animations.rotateHeadDownNW.number = 1 
      animations.rotateHeadUpNW.number = 1.5 
      animations.runningNW.number = 1
      animations.rotateHeadDownNE.number = 7 
      animations.rotateHeadUpNE.number = 7.5 
      animations.runningNE.number = 7
      animations.rotateHeadDownE.number = 6 
      animations.rotateHeadUpE.number = 6.5 
      animations.runningE.number = 6
      animations.rotateHeadDownW.number = 2 
      animations.rotateHeadUpW.number = 2.5 
      animations.runningW.number = 2
      animations.runningSW.number = 5
      animations.runningSE.number = 3
      animations.runningS.number = 4
      animations.idle.number = 10
      animations.rotateHeadDownI.number = 10
      animations.rotateHeadUpI.number = 10.5
      animations.jumpI.number = 10.25

      animations.runningS.timeScale = 1.3
      animations.runningSW.timeScale = 1.3
      animations.runningSE.timeScale = 1.3
    })

    
    
    
    this.players[playerID] = {
      body: body,
      position: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      username: username,
      score: score,
      id: playerID,
      inGame: inGame,
      mixer: mixer,
      animations: animations,
      orientation: 10,
      turnDelta: 0,
      inCheck: false
    }
    
    
    this.players[playerID].activeAction = this.players[playerID].animations.idle
    this.players[playerID].activeAdditiveAction = this.players[playerID].animations.rotateHeadDownI
    this.players[playerID].animations.rotateHeadDownI.play()
    this.players[playerID].animations.idle.play()
    // window.addEventListener('keydown', (e) => {
        
    // })
    
    window.addEventListener('keydown', (e) => {
      if(e.key === 't'){
        // animations.runningN.play()
        // // console.log(animations.idle.isRunning())
        // animations.runningN.weight = 0.1
        // // this.players[playerID].activeAction.startAt(1).fadeOut(1).play()
        // for (let i = 10 ; i != 1; i-=0.25){
        //   setTimeout(() => { 
        //     this.players[playerID].animations.runningN.weight = i / 10
        //     animations.idle.weight = 1 - i/10
        //   }, i * 30)
        // }

        // setTimeout(() => {
        //   this.players[playerID].activeAction.stop()
        // }, 300)

        this.checkAnimation(this.players[playerID], animations.runningN, animations.rotateHeadUpN, animations.rotateHeadDownN)
      }
    })

    // setInterval (() => {
    //   console.log(1)
    //   this.checkAnimation(this.players[playerID], animations.runningE, animations.rotateHeadUpN, animations.rotateHeadDownN)
    //   setTimeout(() => {
    //     this.checkAnimation(this.players[playerID], animations.runningW, animations.rotateHeadUpN, animations.rotateHeadDownN)
    //   },200)
    // },400)


    if(inGame) {
      this.scene.add(this.players[playerID].body)
    }

  }

  
  deleteOtherPlayer(playerID) {
    this.scene.remove(this.players[playerID].body)
    delete this.players[playerID]

    for (let i = 0; i < this.leaderboardArray.length; i++) {
      if (this.leaderboardArray[i].id === playerID) {
        for (let j = i; j < this.leaderboardArray.length; j++) {
          this.leaderboardArray[j] = this.leaderboardArray[j + 1] 
        }
        this.leaderboardArray.length--
        break
      }
    }

    this.updateLeaderboard()
  }

  fillLeaderboardArray = () => {
    this.leaderboardArray[0] = this.player
    for (let playerID in this.players) {
      this.leaderboardArray[this.leaderboardArray.length] = this.players[playerID]
    }
  }

  sortLeaderboardArray = () => {
    this.leaderboardArray.sort((x,y) => {
      return y.score - x.score
    })
  }

  updateLeaderboard = () => {
    this.sortLeaderboardArray()
    for (let row of document.querySelectorAll('.leaderboard-row')) {
      row.remove()
    }
    for (let row of document.querySelectorAll('.leaderboard-row-out')) {
      row.remove()
    }
    for (let i = 0; i < this.leaderboardArray.length; i++) {
      if(this.leaderboardArray[i].inGame) {
        this.ui.leaderboard.innerHTML += 
          `<div class="leaderboard-row"> \
            <div class="leaderboard-name">${this.leaderboardArray[i].username}</div><div class="leaderboard-score">${this.leaderboardArray[i].score}</div> \
          </div>`
      } 
    }
    for (let i = 0; i < this.leaderboardArray.length; i++) {
      if(!this.leaderboardArray[i].inGame) {
        this.ui.leaderboard.innerHTML += 
          `<div class="leaderboard-row-out"> \
            <div class="leaderboard-name">${this.leaderboardArray[i].username}</div><div class="leaderboard-score">${this.leaderboardArray[i].score}</div> \
          </div>`
      } 
    }
    
  }

  addOwnKillMessage = (killedID) => {
    this.killMessageArray.unshift(
    `<div class="kill-message"> \
      <div style="color: #00f; letter-spacing: 0.15em;" class="kill-message-text">${this.player.username}</div> \
      <div style="color: #fff;" class="kill-message-text">  ︻┳═一  </div> \
      <div style="color: #f00; letter-spacing: 0.15em;" class="kill-message-text">${this.players[killedID].username}</div><br> \
    </div>`)

    if(this.killMessageArray.length > 5) {
      this.killMessageArray.length--
    } else {
      setTimeout(() => {
        this.ui.killMessages.children[this.ui.killMessages.children.length - 1].style.animation = 'fadeout 3s'
      }, 8000)
      setTimeout(() => {
        this.killMessageArray.length--
        this.updateKillMessages()
      }, 9000)
    }


    this.updateKillMessages()
  }

  addOwnKilledMessage = (killerID) => {
    this.killMessageArray.unshift(
    `<div class="kill-message"> \
      <div style="color: #f00; letter-spacing: 0.15em;" class="kill-message-text">${this.players[killerID].username}</div><br> \
      <div style="color: #fff;" class="kill-message-text">  ︻┳═一  </div> \
      <div style="color: #00f; letter-spacing: 0.15em;" class="kill-message-text">${this.player.username}</div> \
    </div>`)

    if(this.killMessageArray.length > 5) {
      this.killMessageArray.length--
    } else {
      setTimeout(() => {
        this.ui.killMessages.children[this.ui.killMessages.children.length - 1].style.animation = 'fadeout 1s'
      }, 8000)
      setTimeout(() => {
        this.killMessageArray.length--
        this.updateKillMessages()
      }, 9000)
    }

    

    this.updateKillMessages()
  }

  addKillMessage = (killerID, killedID) => {
    this.killMessageArray.unshift(
      `<div class="kill-message"> \
        <div style="color: #f00; letter-spacing: 0.15em;" class="kill-message-text">${this.players[killerID].username}</div> \
        <div style="color: #fff;" class="kill-message-text">  ︻┳═一  </div> \
        <div style="color: #f00; letter-spacing: 0.15em;" class="kill-message-text">${this.players[killedID].username}</div><br> \
      </div>`
    )

    if(this.killMessageArray.length > 5) {
      this.killMessageArray.length--
    } else {
      setTimeout(() => {
        this.ui.killMessages.children[this.ui.killMessages.children.length - 1].style.animation = 'fadeout 3s'
      }, 8000)
      setTimeout(() => {
        this.killMessageArray.length--
        this.updateKillMessages()
      }, 9000)
    }

    this.updateKillMessages()
  }

  updateKillMessages = () => {
    this.ui.killMessages.innerHTML = ''
    for (let message of this.killMessageArray) {
      this.ui.killMessages.innerHTML += message
    }
  }


  updateOtherPlayerStats = (otherPlayers) => {
    for (let playerID in otherPlayers) {
      if(otherPlayers[playerID].inGame) {
        try {
          if (playerID !== this.player.id) {
            this.players[playerID].position = new THREE.Vector3().fromArray(
              otherPlayers[playerID].position
            )
            this.players[playerID].direction = new THREE.Vector3().fromArray(
              otherPlayers[playerID].direction
            )
            this.players[playerID].orientation = otherPlayers[playerID].orientation
            this.players[playerID].turnDelta = otherPlayers[playerID].turnDelta
          }
        } catch (err) {
          throw err
          //ignore errors in this block <- happens bc of init time
        }
      }
    }
  }

  checkAnimation = (player, mainAnim, additiveUp, additiveDown) => {
    if (player.direction.y >= 0) {
      if (player.activeAdditiveAction.number != additiveUp.number){
        player.activeAdditiveAction.stop()
        additiveUp.play() 
        player.activeAdditiveAction = additiveUp
      }
    } else {
      if (player.activeAdditiveAction.number != additiveDown.number){
        player.activeAdditiveAction.stop()
        additiveDown.play() 
        player.activeAdditiveAction = additiveDown
      }
    } 
    if (player.activeAction.number != mainAnim.number && !player.inCheck){
      player.inCheck = true
      mainAnim.play()
      mainAnim.weight = 0.025
      for (let i = 10 ; i != 1; i-=0.25){
        setTimeout(() => { 
          mainAnim.weight = i / 10
          player.activeAction.weight = 1 - i/10
        }, i * 15)
      }
      setTimeout(() => {
        player.activeAction.stop()
        player.activeAction = mainAnim
        player.inCheck = false
        console.log('e')
      }, 150)
    }
  }

  

  updateOtherPlayers = (deltaTime) => {
    for (let playerID in this.players) {
      if (this.players[playerID].inGame) {
        let angle = Math.atan2(Math.abs(this.players[playerID].direction.y),Math.sqrt(this.players[playerID].direction.x*this.players[playerID].direction.x +this.players[playerID].direction.z*this.players[playerID].direction.z))
        this.players[playerID].activeAdditiveAction.time = 2.25 * angle
        this.players[playerID].mixer.update(deltaTime)
        this.players[playerID].body.position.set(
          this.players[playerID].position.x,
          this.players[playerID].position.y - this.player.height,
          this.players[playerID].position.z
        )

        if(!this.players[playerID].activeAction.isRunning()) {
          this.players[playerID].activeAction.play()
        }
        switch (this.players[playerID].orientation) {
          default:
          case 10:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.idle , 
              this.players[playerID].animations.rotateHeadUpI, 
              this.players[playerID].animations.rotateHeadDownI, 
            )
            if (this.players[playerID].turnDelta >= 0.01 || this.players[playerID].turnDelta <= -0.01) {
              if(!this.players[playerID].animations.idleR.isRunning()) {
                this.players[playerID].animations.idleR.play()
                setTimeout(() => {
                  this.players[playerID].animations.idleR.stop()
                }, 833)
              }
            } 
          break
          case 0:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningN , 
              this.players[playerID].animations.rotateHeadUpN, 
              this.players[playerID].animations.rotateHeadDownN, 
            )
          break
          case 1:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningNW , 
              this.players[playerID].animations.rotateHeadUpNW, 
              this.players[playerID].animations.rotateHeadDownNW, 
            )
          break
          case 2:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningW , 
              this.players[playerID].animations.rotateHeadUpW, 
              this.players[playerID].animations.rotateHeadDownW, 
            ) 
          break
          case 3:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningSE , 
              this.players[playerID].animations.rotateHeadUpNE, 
              this.players[playerID].animations.rotateHeadDownNE, 
            )
          break
          case 4:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningS , 
              this.players[playerID].animations.rotateHeadUpN, 
              this.players[playerID].animations.rotateHeadDownN, 
            )
          break
          case 5:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningSW , 
              this.players[playerID].animations.rotateHeadUpNW, 
              this.players[playerID].animations.rotateHeadDownNW, 
            )
          break
          case 6:
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningE , 
              this.players[playerID].animations.rotateHeadUpE, 
              this.players[playerID].animations.rotateHeadDownE, 
            )
          break
          case 7: 
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.runningNE , 
              this.players[playerID].animations.rotateHeadUpNE, 
              this.players[playerID].animations.rotateHeadDownNE, 
            )
          break
          case 0.5:
          case 1.5:
          case 2.5:
          case 3.5:
          case 4.5:
          case 5.5:
          case 6.5:
          case 7.5:  
          case 8.5:
          case 9.5:
          case 10.5:  
            this.checkAnimation(
              this.players[playerID],
              this.players[playerID].animations.jumpI , 
              this.players[playerID].animations.rotateHeadUpI, 
              this.players[playerID].animations.rotateHeadDownI, 
            )
          break
        }
        if ( this.players[playerID].direction.x > 0 ) {
          this.players[playerID].body.rotation.y = Math.PI - Math.atan( this.players[playerID].direction.z / this.players[playerID].direction.x )
        } else {
          this.players[playerID].body.rotation.y = - Math.atan( this.players[playerID].direction.z / this.players[playerID].direction.x )
        }
      }
    }
  }

  sendPosition = () => {
    let orientation
    const leftRight = Number(this.moveRight) - Number(this.moveLeft)
    const forwardBackward = Number(this.moveForward) - Number(this.moveBackward)
    if (leftRight === 0 && forwardBackward === 1)
      if (this.isJumping) orientation = 0.5
      else orientation = 0
    else if (leftRight === 1 && forwardBackward === 1)
      if (this.isJumping) orientation = 1.5
      else orientation = 1
    else if (leftRight === 1 && forwardBackward === 0)
      if (this.isJumping) orientation = 2.5
      else orientation = 2
    else if (leftRight === 1 && forwardBackward === -1)
      if (this.isJumping) orientation = 3.5
      else orientation = 3
    else if (leftRight === 0 && forwardBackward === -1)
      if (this.isJumping) orientation = 4.5
      else orientation = 4
    else if (leftRight === -1 && forwardBackward === -1)
      if (this.isJumping) orientation = 5.5
      else orientation = 5
    else if (leftRight === -1 && forwardBackward === 0)
      if (this.isJumping) orientation = 6.5
      else orientation = 6
    else if (leftRight === -1 && forwardBackward === 1)
      if (this.isJumping) orientation = 7.5
      else orientation = 7
    else if (leftRight === 0 && forwardBackward === 0)
      if (this.isJumping) orientation = 10.5
      else orientation = 10
    this.socket.emit(
        'position',
        [
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z,
        ],
        this.lookVector().toArray(),
        orientation,
        this.turnDelta
    ) 
    if(this.turnDelta > 0.01 || this.turnDelta < -0.01) {
      this.turnDelta = 0
    }
  }

  sendShoot = (bullet) => {
    this.socket.emit('shoot', bullet)
  }


  lookVector = () => {
    this.camera.getWorldDirection(this.direction)
    this.direction.normalize()
    return this.direction
  }

  hitPlayer = ( hitPlayerID, bullet, point) => {
    this.createDamageParticle(point, bullet.damage)
    this.socket.emit(
      'playerHit', 
      hitPlayerID, 
      bullet,
      point.toArray()
    )
  }

  sendSpawn = () => {
    this.socket.emit('spawn')
  }

  startOrbitAnimation = () => {
    this.requestAnimId.other = requestAnimationFrame(this.startOrbitAnimation)
    this.orbitTick()
  }

  stopOrbitAnimation = () => {
    cancelAnimationFrame(this.requestAnimId.other)
  }

  resetHealthBar = () => {
    this.ui.healthBar.wrapper.style.display = 'block'
    this.ui.healthBar.bar.style.width = '75%'
   this.player.health = 100
    this.ui.healthBar.bar.style.background = '#1ce490'
  }

  wasKilled = (killerID) => {
    this.player.inGame = false
    console.log(killerID)
    this.socket.emit(
      'playerKilled', 
      killerID,
      this.player.id
    )

    this.scene.remove(this.camera)
    this.stopAnimation()
    this.inputsDisabled = true
    document.exitPointerLock()

    this.player.health = 0
    this.player.score = 0
    this.ui.healthBar.wrapper.style.display = 'none' 

    this.addOwnKilledMessage(killerID)


    this.player.score = 0
    this.updateLeaderboard()

    this.player.feet.material = new THREE.MeshToonMaterial({ color: 0x333333 })
    this.player.body.material = new THREE.MeshToonMaterial({ color: 0x333333 })
    
    this.startOrbitAnimation()

    switch (this.player.class) {
      case 1:
        this.ui.respawnAssaultField.checked = true
        break
      case 2:
        this.ui.respawnShotgunField.checked = true
        break
      case 3:
        this.ui.respawnSniperField.checked = true
        break
    }

    this.ui.respawnAssaultField.style.display = 'block'

    this.ui.respawnButton.style.display = 'block'
    this.ui.respawnButton.querySelector('#respawn-button').style.pointerEvents = 'none'
    this.ui.respawnButton.querySelector('#respawn-button').style.userSelect = 'none'
    this.ui.respawnButton.querySelector('#respawn-button').style.fontSize = '15px'
    this.ui.respawnButton.querySelector('#respawn-button').textContent = `Respawn in 5`
    this.ui.respawnButton.querySelector('.respawn-text').textContent = `You were killed by ${this.players[killerID].username}`
    this.ui.weaponStats.ammoCount.parentNode.style.display = 'none'
    this.ui.weaponStats.reloadTime.style.display = 'none'

    let countdown = 5
    const timer = setInterval(() => {
        countdown--
        if(countdown <= 0) {
          clearInterval(timer)
        }
        this.ui.respawnButton.querySelector('#respawn-button').textContent = `Respawn in ${countdown}`
    }, 1000)

    setTimeout(() => {
        this.ui.respawnButton.querySelector('#respawn-button').style.pointerEvents = 'unset'
        this.ui.respawnButton.querySelector('#respawn-button').style.userSelect = 'unset'
        this.ui.respawnButton.querySelector('#respawn-button').textContent = `RESPAWN`
        this.ui.respawnButton.querySelector('#respawn-button').style.fontSize = '20px'

        this.player.feet.material = new THREE.MeshNormalMaterial()
        this.player.body.material = new THREE.MeshNormalMaterial()
        this.scene.remove(this.killArrow)
        this.scene.remove(this.player.feet)
        this.scene.remove(this.player.body)

    }, 5000)
  }

}

export default new Game()
