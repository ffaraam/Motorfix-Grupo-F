const fs = require('node:fs/promises');
const path = require('node:path');

const dataDirectory = path.join(__dirname, '..', '..', 'data');
const usersFile = path.join(dataDirectory, 'users.json');
const managerFile = path.join(__dirname, '..', '..', 'config', 'manager-account.json');
const mechanicFile = path.join(__dirname, '..', '..', 'config', 'mechanic-accounts.json');
const testClientFile = path.join(__dirname, '..', '..', 'config', 'test-client-accounts.json');
let writeQueue = Promise.resolve();
let registrationQueue = Promise.resolve();

async function ensureUserStore() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(usersFile);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeUsers([]);
  }
  await ensureManagerAccount();
  await ensureMechanicAccounts();
  await ensureTestClientAccounts();
}

async function ensureManagerAccount() {
  const [users, manager] = await Promise.all([
    readUsersFile(),
    fs.readFile(managerFile, 'utf8').then(JSON.parse)
  ]);
  const email = manager.email.trim().toLowerCase();
  const existingIndex = users.findIndex((user) => user.email === email);
  if (existingIndex >= 0 && users[existingIndex].role === manager.role && users[existingIndex].passwordHash === manager.passwordHash) return;

  const now = new Date().toISOString();
  const managerRecord = {
    ...(existingIndex >= 0 ? users[existingIndex] : {}),
    id: existingIndex >= 0 ? users[existingIndex].id : require('node:crypto').randomUUID(),
    nombre: manager.nombre,
    email,
    telefono: existingIndex >= 0 ? users[existingIndex].telefono : '',
    passwordHash: manager.passwordHash,
    role: manager.role,
    createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : now
  };
  if (existingIndex >= 0) users[existingIndex] = managerRecord;
  else users.push(managerRecord);
  await writeUsers(users);
}

async function ensureMechanicAccounts() {
  const [users, mechanics] = await Promise.all([
    readUsersFile(),
    fs.readFile(mechanicFile, 'utf8').then(JSON.parse)
  ]);
  let changed = false;
  for (const mechanic of mechanics) {
    const email = mechanic.email.trim().toLowerCase();
    let existingIndex = users.findIndex((user) => user.mechanicKey === mechanic.key);
    if (existingIndex < 0) existingIndex = users.findIndex((user) => user.email === email);
    const current = existingIndex >= 0 ? users[existingIndex] : null;
    if (current?.role === mechanic.role && current.email === email && current.passwordHash === mechanic.passwordHash && current.liftId && current.mechanicKey === mechanic.key) continue;
    const record = {
      ...(current || {}),
      id: current?.id || require('node:crypto').randomUUID(),
      mechanicKey: mechanic.key,
      nombre: mechanic.nombre,
      email,
      telefono: current?.telefono || '',
      passwordHash: mechanic.passwordHash,
      role: mechanic.role,
      liftId: current?.liftId || mechanic.liftId,
      createdAt: current?.createdAt || new Date().toISOString()
    };
    if (existingIndex >= 0) users[existingIndex] = record;
    else users.push(record);
    changed = true;
  }
  if (changed) await writeUsers(users);
}

async function ensureTestClientAccounts() {
  if (process.env.NODE_ENV === 'production') return;
  const [users, clients] = await Promise.all([
    readUsersFile(),
    fs.readFile(testClientFile, 'utf8').then(JSON.parse)
  ]);
  let changed = false;
  for (const client of clients) {
    const email = client.email.trim().toLowerCase();
    const existingIndex = users.findIndex((user) => user.email === email);
    const current = existingIndex >= 0 ? users[existingIndex] : null;
    if (current?.role === 'cliente' && current.passwordHash === client.passwordHash) continue;
    const record = {
      ...(current || {}),
      id: current?.id || require('node:crypto').randomUUID(),
      nombre: client.nombre,
      email,
      telefono: client.telefono,
      passwordHash: client.passwordHash,
      role: 'cliente',
      createdAt: current?.createdAt || new Date().toISOString()
    };
    if (existingIndex >= 0) users[existingIndex] = record;
    else users.push(record);
    changed = true;
  }
  if (changed) await writeUsers(users);
}

function updateMechanicLift(mechanicId, liftId) {
  const operation = registrationQueue.then(async () => {
    const users = await readUsers();
    const mechanic = users.find((user) => user.id === mechanicId && user.role === 'mecanico');
    if (!mechanic) throw Object.assign(new Error('No encontramos esa cuenta de mecánico.'), { code: 'NOT_FOUND' });
    if (mechanic.liftId === liftId) return mechanic;
    const otherMechanic = users.find((user) => user.role === 'mecanico' && user.liftId === liftId && user.id !== mechanic.id);
    const previousLiftId = mechanic.liftId;
    mechanic.liftId = liftId;
    if (otherMechanic) otherMechanic.liftId = previousLiftId;
    await writeUsers(users);
    return mechanic;
  });
  registrationQueue = operation.catch(() => {});
  return operation;
}

async function readUsersFile() {
  const contents = await fs.readFile(usersFile, 'utf8');
  const users = JSON.parse(contents);
  if (!Array.isArray(users)) throw new Error('El archivo de usuarios tiene un formato inválido.');
  return users;
}

async function readUsers() {
  await ensureUserStore();
  const contents = await fs.readFile(usersFile, 'utf8');
  const users = JSON.parse(contents);
  if (!Array.isArray(users)) throw new Error('El archivo de usuarios tiene un formato inválido.');
  return users;
}

function writeUsers(users) {
  const operation = writeQueue.then(async () => {
    await fs.mkdir(dataDirectory, { recursive: true });
    const temporaryFile = `${usersFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(users, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryFile, usersFile);
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

function addUser(user) {
  const operation = registrationQueue.then(async () => {
    const users = await readUsers();
    const emailExists = users.some((item) => item.email === user.email);
    if (emailExists) {
      const error = new Error('Ese correo electrónico ya está registrado.');
      error.code = 'USER_CONFLICT';
      throw error;
    }
    users.push(user);
    await writeUsers(users);
    return user;
  });
  registrationQueue = operation.catch(() => {});
  return operation;
}

module.exports = { addUser, ensureUserStore, readUsers, updateMechanicLift };
