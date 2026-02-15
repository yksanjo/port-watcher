# Port Watcher

Watch ports for availability changes and notify when they become free or occupied.

## Installation

```bash
cd port-watcher
npm install
```

## Usage

### Watch a port continuously

```bash
npm start watch 3000
```

### Wait for a port to become available

```bash
npm start wait 3000
# With timeout
npm start wait 3000 -- -t 30
```

### Monitor multiple ports

```bash
npm start monitor 3000 3001 8080 27017
```

## Commands

| Command | Description |
|---------|-------------|
| `watch <port>` | Watch a port for changes |
| `wait <port>` | Wait for port to become available |
| `monitor [ports...]` | Monitor multiple ports |

## Options

- `-i, --interval <seconds>` - Check interval (default: 2s for watch, 5s for monitor)
- `-o, --once` - Check only once and exit
- `-q, --quiet` - Minimal output
- `-t, --timeout <seconds>` - Max time to wait (for wait command)
