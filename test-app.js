#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Tricity Match Application...\n');

// Function to run a command
function runCommand(command, args, cwd, name) {
  return new Promise((resolve, reject) => {
    console.log(`📦 Starting ${name}...`);
    
    const process = spawn(command, args, {
      cwd: cwd,
      stdio: 'pipe',
      shell: true
    });

    process.stdout.on('data', (data) => {
      console.log(`[${name}] ${data.toString().trim()}`);
    });

    process.stderr.on('data', (data) => {
      console.error(`[${name}] ${data.toString().trim()}`);
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${name} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${name} failed with code ${code}`);
        reject(new Error(`${name} failed`));
      }
    });

    process.on('error', (error) => {
      console.error(`❌ Error starting ${name}:`, error.message);
      reject(error);
    });
  });
}

// Function to check if a port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(false); // Port is available
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(true); // Port is in use
    });
  });
}

async function main() {
  try {
    // Check if ports are available
    const backendPort = await checkPort(5000);
    const frontendPort = await checkPort(5173);

    if (backendPort) {
      console.log('⚠️  Port 5000 is already in use. Please stop the backend server first.');
    }

    if (frontendPort) {
      console.log('⚠️  Port 5173 is already in use. Please stop the frontend server first.');
    }

    console.log('\n📋 Setup Instructions:');
    console.log('1. Make sure PostgreSQL is running');
    console.log('2. Update backend/.env.development with your database credentials');
    console.log('3. Run database migrations: cd backend && npm run migrate');
    console.log('4. Seed the database: cd backend && npm run seed');
    console.log('5. Start the backend: cd backend && npm run dev');
    console.log('6. Start the frontend: cd frontend && npm run dev');
    console.log('\n🌐 URLs:');
    console.log('Frontend: http://localhost:5173');
    console.log('Backend API: http://localhost:5000/api');
    console.log('\n✨ Happy coding!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
