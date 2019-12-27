module.exports = function MerchantHelper(mod) {
	const notifier = mod.require ? mod.require.notifier : require('tera-notifier')(mod)
	const Message = require('../tera-message')
	const MSG = new Message(mod)
	
	
	let mobid = [],
		boss = null,
		bossName = null,
		sysMsg = null,
		npcID = null,
		bossHunting = 0,
		bossTemplate = 0
	
	mod.command.add(["mh"], (arg) => {
		if (!arg) {
			mod.settings.enabled = !mod.settings.enabled
			MSG.chat("Merchant-Helper: " + (mod.settings.enabled ? MSG.BLU("On") : MSG.YEL("Off")))
			if (!mod.settings.enabled) {
				for (let i of mobid) {
					despawnItem(i)
				}
			}
		} else {
			switch (arg) {
				case "alert":
					mod.settings.alerted = !mod.settings.alerted
					MSG.chat("alert " + (mod.settings.alerted ? MSG.BLU("on") : MSG.YEL("off")))
					break
				case "notice":
					mod.settings.notice = !mod.settings.notice
					MSG.chat("notice " + (mod.settings.notice ? MSG.BLU("on") : MSG.YEL("off")))
					break
				case "message":
					mod.settings.messager = !mod.settings.messager
					MSG.chat("message " + (mod.settings.messager ? MSG.BLU("on") : MSG.YEL("off")))
					break
				case "mark":
					mod.settings.marker = !mod.settings.marker
					MSG.chat("marker " + (mod.settings.marker ? MSG.BLU("on") : MSG.YEL("off")))
					break
				case "clear":
					MSG.chat("Boss-Helper " + TIP("cleared Marker"))
					for (let i of mobid) {
						despawnItem(i)
					}
					break
				case "status":
					MSG.chat("------------ BOSS ------------")
					for (const i of mod.settings.bosses) {
						if (i.logTime == undefined) continue
						if (![5001, 501, 4001].includes(i.templateId)) continue
						
						var nextTime = i.logTime + 5*60*60*1000
						if (i.logTime == 0) {
							MSG.chat(MSG.RED(i.name) + MSG.YEL("nothing tracked"))
						} else if (Date.now() < nextTime) {
							MSG.chat(MSG.RED(i.name) + " next " + MSG.TIP(getTime(nextTime)))
						} else {
							MSG.chat(MSG.RED(i.name) + " last " + MSG.GRY(getTime(nextTime)))
						}
					}
					// break
				// case "merchant":
					MSG.chat("------------ Mystery Merchant ------------")
					for (const j of mod.settings.bosses) {
						if (j.logTime == undefined) continue
						if (![63, 72, 84, 183].includes(j.huntingZoneId)) continue
						
						var nextTime = j.logTime + 24*60*60*1000
						if (j.logTime == 0) {
							MSG.chat(MSG.PIK(j.name) + MSG.YEL("nothing tracked"))
						} else if (Date.now() < nextTime) {
							MSG.chat(MSG.PIK(j.name) + " next " + MSG.TIP(getTime(nextTime)))
						} else {
							MSG.chat(MSG.PIK(j.name) + " last " + MSG.GRY(getTime(nextTime)))
						}
					}
					break
				default:
					MSG.chat("Boss-Helper " + MSG.RED("wrong parameter!"))
					break
			}
		}
	})
	
	mod.game.me.on('change_zone', (zone, quick) => {
		mobid = []
	})
	
	mod.hook('S_SPAWN_NPC', 11, (event) => {
		if (!mod.settings.enabled) return
		
		whichBoss(event.huntingZoneId, event.templateId)
		if (boss) {
			if (mod.settings.marker) {
				spawnItem(event.gameId, event.loc)
				mobid.push(event.gameId)
			}
			if (mod.settings.alerted) {
				MSG.alert(( boss.name + " found "), 44)
			}
			if (mod.settings.notice) {
				MSG.raids( boss.name + " found ")
			}
		}
		
		if (event.walkSpeed != 240) return;
		
		switch (event.templateId) {
			case 5001: // Ortan
				event.shapeId = 303730;
				event.huntingZoneId = 434;
				event.templateId = 7000;
				load(event);
				return true;
			case 501:  // Hazard
				event.shapeId = 303740;
				event.huntingZoneId = 777;
				event.templateId = 77730;
				load(event);
				return true;
			case 4001: // Cerrus
				event.shapeId = 303750;
				event.huntingZoneId = 994;
				event.templateId = 1000;
				load(event);
				return true;
		}
	})
	
	mod.hook('S_DESPAWN_NPC', 3, {order: -100}, (event) => {
		if (!mobid.includes(event.gameId)) return
		
		whichBoss(event.huntingZoneId, event.templateId)
	
		despawnItem(event.gameId)
		mobid.splice(mobid.indexOf(event.gameId), 1)
	})
	
	mod.hook('S_SYSTEM_MESSAGE', 1, (event) => {
		if (!mod.settings.enabled || !mod.settings.messager) return
		
		sysMsg = mod.parseSystemMessage(event.message)
		switch (sysMsg.id) {
			case 'SMT_FIELDBOSS_APPEAR':
				getBossMsg(sysMsg.tokens.npcName)
				whichBoss(bossHunting, bossTemplate)
				if (boss) {
					MSG.chat(MSG.BLU("SPAWNED ") + MSG.RED(boss.name))
					notificationafk("SPAWNED " + boss.name)
				}
				break
			case 'SMT_FIELDBOSS_DIE_GUILD':
			case 'SMT_FIELDBOSS_DIE_NOGUILD':
				getBossMsg(sysMsg.tokens.npcname)
				whichBoss(bossHunting, bossTemplate)
				if (boss) {
					var nextTime = Date.now() + 5*60*60*1000
					MSG.chat(MSG.RED(boss.name) + " next " + MSG.TIP(getTime(nextTime)))
					saveTime()
				}
				break
			
			case 'SMT_WORLDSPAWN_NOTIFY_SPAWN':
				getBossMsg(sysMsg.tokens.npcName)
				whichBoss(bossHunting, bossTemplate)
				if (boss) {
					if ([1276, 1284].includes(bossTemplate)) {
						MSG.party("Spawned " + boss.name)
					} else {
						MSG.chat(MSG.BLU("Spawned ") + MSG.PIK(boss.name))
					}
					notificationafk("Spawned " + boss.name)
					saveTime()
				}
				break
			case 'SMT_WORLDSPAWN_NOTIFY_DESPAWN':
				
				break
			default :
				break
		}
	})
	
	function getBossMsg(id) {
		npcID = id.match(/\d+/ig)
		bossHunting  = parseInt(npcID[0])
		bossTemplate = parseInt(npcID[1])
	}
	
	function whichBoss(h_ID, t_ID) {
		if (mod.settings.bosses.find(b => b.huntingZoneId == h_ID && b.templateId == t_ID)) {
			boss = mod.settings.bosses.find(b => b.huntingZoneId == h_ID && b.templateId == t_ID)
		} else {
			boss = null
		}
	}
	
	function saveTime() {
		for (let i=0; i < mod.settings.bosses.length; i++) {
			if (mod.settings.bosses[i].logTime == undefined) continue
			if (mod.settings.bosses[i].huntingZoneId != bossHunting ) continue
			if (mod.settings.bosses[i].templateId != bossTemplate) continue
			
			mod.settings.bosses[i].logTime = Date.now()
		}
	}
	
	function getTime(thisTime) {
		var Time = new Date(thisTime)
		return	add_0(Time.getMonth()+1) + "/" + add_0(Time.getDate()) + " " +
				add_0(Time.getHours())   + ":" + add_0(Time.getMinutes())
	}
	
	function add_0(i) {
		if (i < 10) {
			i = "0" + i;
		}
		return i;
	}
	
	function spawnItem(gameId, loc) {
		mod.send('S_SPAWN_DROPITEM', 8, {
			gameId: gameId*10n,
			loc: loc,
			item: mod.settings.itemId,
			amount: 1,
			expiry: 999999
		})
	}
	
	function despawnItem(gameId) {
		mod.send('S_DESPAWN_DROPITEM', 4, {
			gameId: gameId*10n
		})
	}

	
	function notificationafk(msg, timeout) { // timeout in milsec
		notifier.notifyafk({
			title: 'NekOWO-Notification',
			message: msg,
			wait: false, 
			sound: 'Notification.IM', 
		}, timeout)
	}
}
