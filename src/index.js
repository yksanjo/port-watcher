#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const net = require('net');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const program = new Command();

program
  .name('port-watcher')
  .description('Watch ports for availability changes and notify when they become free or occupied')
  .version('1.0.0');

/**
 * Check if a port is available
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE' ? false : false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Get process info for a port
 */
async function getPortInfo(port) {
  try {
    const { stdout } = await execPromise(`lsof -i :${port} -t`);
    const pid = stdout.trim();
    if (pid) {
      const { stdout: psOut } = await execPromise(`ps -p ${pid} -o args=`);
      return { pid, command: psOut.trim() };
    }
  } catch (error) {
    // Port not in use or error
  }
  return null;
}

/**
 * Format timestamp
 */
function formatTime() {
  return new Date().toLocaleTimeString();
}

program
  .command('watch')
  .description('Watch a port for changes')
  .argument('<port>', 'Port number to watch')
  .option('-i, --interval <seconds>', 'Check interval in seconds', '2')
  .option('-o, --once', 'Check only once and exit')
  .option('-q, --quiet', 'Minimal output')
  .action(async (port, options) => {
    const portNum = parseInt(port);
    const intervalMs = parseInt(options.interval) * 1000;
    
    console.log(chalk.blue.bold('\n🔍 Port Watcher'));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(`   Watching port: ${chalk.cyan(portNum)}`);
    console.log(`   Check interval: ${options.interval}s`);
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.yellow('   Press Ctrl+C to stop\n'));

    let lastState = null;
    let checkCount = 0;

    const checkPort = async () => {
      checkCount++;
      const isAvailable = await isPortAvailable(portNum);
      const currentState = isAvailable ? 'free' : 'occupied';
      
      if (currentState !== lastState || options.once) {
        lastState = currentState;
        
        if (isAvailable) {
          console.log(chalk.green(`[${formatTime()}] ✅ Port ${portNum} is now AVAILABLE`));
        } else {
          const info = await getPortInfo(portNum);
          if (options.quiet) {
            console.log(chalk.red(`[${formatTime()}] ❌ Port ${portNum} is OCCUPIED`));
          } else {
            console.log(chalk.red(`[${formatTime()}] ❌ Port ${portNum} is OCCUPIED`));
            if (info) {
              console.log(chalk.gray(`   PID: ${info.pid}, Command: ${info.command}`));
            }
          }
        }
        
        // Print separator on state change
        if (currentState !== lastState && !options.once) {
          console.log(chalk.gray('─'.repeat(50)));
        }
      } else if (!options.quiet && !options.once) {
        console.log(chalk.gray(`[${formatTime()}] Port ${portNum} still ${currentState}...`));
      }

      if (options.once) {
        process.exit(isAvailable ? 0 : 1);
      }
    };

    // Initial check
    await checkPort();

    if (!options.once) {
      const interval = setInterval(checkPort, intervalMs);
      
      process.on('SIGINT', () => {
        clearInterval(interval);
        console.log(chalk.gray('\n\n👋 Stopped watching.'));
        process.exit(0);
      });
    }
  });

program
  .command('wait')
  .description('Wait for a port to become available')
  .argument('<port>', 'Port number to wait for')
  .option('-t, --timeout <seconds>', 'Max time to wait (0 = infinite)', '0')
  .option('-q, --quiet', 'Only output when available')
  .action(async (port, options) => {
    const portNum = parseInt(port);
    const timeout = parseInt(options.timeout);
    const startTime = Date.now();
    
    if (!options.quiet) {
      console.log(chalk.blue(`\n⏳ Waiting for port ${portNum} to become available...`));
    }

    while (true) {
      const isAvailable = await isPortAvailable(portNum);
      
      if (isAvailable) {
        if (options.quiet) {
          console.log(portNum);
        } else {
          console.log(chalk.green(`\n✅ Port ${portNum} is now available!`));
        }
        process.exit(0);
      }

      // Check timeout
      if (timeout > 0) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed >= timeout) {
          console.log(chalk.red(`\n⏱️ Timeout after ${timeout} seconds`));
          process.exit(1);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

program
  .command('monitor')
  .description('Monitor multiple ports continuously')
  .argument('[ports...]', 'Port numbers to monitor')
  .option('-i, --interval <seconds>', 'Check interval in seconds', '5')
  .action(async (ports, options) => {
    if (ports.length === 0) {
      console.log(chalk.yellow('Please specify ports to monitor'));
      console.log('Usage: port-watcher monitor 3000 3001 8080');
      process.exit(1);
    }

    const portNums = ports.map(p => parseInt(p));
    
    console.log(chalk.blue.bold('\n📊 Port Monitor'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log(`   Monitoring: ${chalk.cyan(portNums.join(', '))}`);
    console.log(`   Check interval: ${options.interval}s`);
    console.log(chalk.gray('═'.repeat(60)));
    console.log(chalk.yellow('   Press Ctrl+C to stop\n'));

    const getStatus = async (port) => {
      const available = await isPortAvailable(port);
      return available ? chalk.green('● FREE') : chalk.red('● BUSY');
    };

    const display = async () => {
      const status = await Promise.all(portNums.map(async (port) => {
        const info = await getPortInfo(port);
        const status = await getStatus(port);
        return { port, status, info };
      }));
      
      console.clear();
      console.log(chalk.blue.bold('\n📊 Port Monitor'));
      console.log(chalk.gray('═'.repeat(60)));
      
      for (const s of status) {
        const busyInfo = s.info ? ` (PID: ${s.info.pid})` : '';
        console.log(`   ${chalk.cyan(String(s.port).padEnd(6))} ${s.status}${busyInfo}`);
      }
      
      console.log(chalk.gray('─'.repeat(60)));
      console.log(chalk.gray(`   Last update: ${new Date().toLocaleString()}`));
    };

    await display();
    const interval = setInterval(display, parseInt(options.interval) * 1000);

    process.on('SIGINT', () => {
      clearInterval(interval);
      console.log(chalk.gray('\n\n👋 Stopped monitoring.'));
      process.exit(0);
    });
  });

program.parse();
