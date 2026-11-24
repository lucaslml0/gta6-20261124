# gta6-20261124

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lucaslml0/gta6-20261124/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lucaslml0/gta6-20261124/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice City Nights** — a top-down open-world crime game in vanilla JS + canvas 2D (no libraries, no network requests). A 3200×2400 city of roads, buildings, parks, traffic and pedestrians. Steal cars, outrun the cops, and finish three story missions to take the $1,900 on the table and own the city.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — or just open `game/index.html` in a browser (no build step).

## The game

- **Open world:** drive or walk a road-grid city with traffic cars, wandering pedestrians, parks and buildings.
- **Car theft & driving:** press **E** next to any car to steal it (the cops notice), **E** again to step out. Real car physics: acceleration, braking, steering, collisions.
- **Wanted level 0–5★:** stealing cars, hitting pedestrians and speeding past patrol cars raises the heat. Police cars spawn, chase, ram and try to bust you; break line of sight and the stars fade.
- **Missions & story:** three jobs with a HUD tracker — *Hot Wheels* (steal a car, deliver it to the chop shop), *Clean Getaway* (reach 3★ then lose the heat), *Package Run* (collect 5 drops). Finish all three and you own the city.
- **Combat:** **Space** punches on foot and shoots from the car. Health, busted/wasted game-over states, restart.
- **HUD & minimap:** health, cash, wanted stars, mission objective, and a live minimap showing you, police and the mission marker.
- **Save:** cash and mission progress persist in localStorage — the title screen offers Continue.
- **Sound:** synthesised WebAudio only — engine hum, police siren, pickups and crashes. No audio files.
- **Pause:** **P**. Screenshot scenes: `?shot=start|play|end`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive the car |
| E | Steal / enter car, exit car |
| Space | Punch on foot, shoot from the car |
| P / Esc | Pause |
| Enter / click | Start, restart |

---

<sub>Entered on [make.fun](https://make.fun/?ref=w8dfntsk&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
