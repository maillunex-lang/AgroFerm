# Структура репозитория

Создаются только файлы с содержанием. Пустые каталоги под будущий код не заведены.

## Есть сейчас

```
README.md                 кратко, для человека
START.md                  вход для любого ИИ
PROJECT_CONTEXT.md        снимок на сейчас
ROAD.md                   статусы и очередь
DECISIONS.md              APPROVED и PROPOSED
docs/STRUCTURE.md         этот файл
docs/AI_WORKFLOW.md       как делить работу между ИИ
docs/concept/             разбор концепции
docs/gdd/                 каталог систем; полный GDD ещё не написан
docs/architecture/        предварительная архитектура, не утверждена
docs/geography/           источники карты и лицензии, без данных
docs/design/              вопросы владельцу, по этапам
docs/phases/              этапы 0–12
docs/security/            базовые правила до появления кода
docs/operations/          среды, без боевого сервера
```

## Появится вместе с кодом, не раньше

```
client/          Godot, только с PHASE-03
server/          Go, только с PHASE-03
admin/           React, только с PHASE-03
shared/          общие контракты, вместе с первым API
tools/           симулятор экономики и утилиты данных
assets/          после лицензий и стандартов из docs/art
tests/           рядом с кодом, не впрок
deploy/          Docker Compose, когда есть что запускать
.github/         CI, когда есть команда проверки
```

Каталоги `docs/world`, `docs/farming`, `docs/livestock`, `docs/machinery`, `docs/construction`, `docs/production`, `docs/economy`, `docs/logistics`, `docs/progression`, `docs/quests`, `docs/online`, `docs/ai`, `docs/monetization`, `docs/ui`, `docs/art` создаются на этапе 1, каждый сразу с спецификацией, а не с пустым README.

## Именование

- Решение: `DECISION-<ОБЛАСТЬ>-NNN`
- Вопрос: `Q-<ОБЛАСТЬ>-NNN`
- Рекомендация: `REC-<ОБЛАСТЬ>-NNN`
- Система: `SYS-<ИМЯ>`
- Этап: `PHASE-NN`
- Срез: тот же номер, что этап реализации. Срез №1 = `PHASE-03`

Секреты, `.env`, keystore и выгрузки OSM в git не класть. См. `.gitignore`.
