import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import * as db from 'firebase/database';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { createDriverBackend } from '../js/driver-backend.js';

if(process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9000'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099') throw new Error('Integration tests require localhost demo emulators.');
let environment,app,auth,database,backend;
const projectId='demo-ful-bus-tracker';
const email='test-'+Date.now()+'@example.test';
const testPassword='emulator-test-only-password';
before(async()=>{
  environment=await initializeTestEnvironment({projectId,database:{host:'127.0.0.1',port:9000,rules:await readFile('database.rules.json','utf8')}});
  await environment.clearDatabase();
  app=initializeApp({apiKey:'demo-only-api-key',projectId,databaseURL:'https://'+projectId+'.firebaseio.com'},'driver-integration');
  auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
  database=db.getDatabase(app);db.connectDatabaseEmulator(database,'127.0.0.1',9000);
  const {user}=await createUserWithEmailAndPassword(auth,email,testPassword);
  await environment.withSecurityRulesDisabled(context=>context.database().ref('drivers/'+user.uid).set({busId:'FUL-001'}));
  backend=createDriverBackend({db,database},'FUL-001');
});
after(async()=>{if(database)db.goOffline(database);if(app)await deleteApp(app);await environment?.cleanup();});
test('real Auth emulator rejects wrong password and signs in the assigned driver',async()=>{
  await assert.rejects(signInWithEmailAndPassword(auth,email,'wrong-emulator-password'));
  await signInWithEmailAndPassword(auth,email,testPassword);
  assert.equal((await db.get(db.ref(database,'drivers/'+auth.currentUser.uid+'/busId'))).val(),'FUL-001');
});
test('backend claims, arms disconnect, publishes GPS, prevents a second trip, and ends',async()=>{
  const session=crypto.randomUUID();
  await backend.claim(session,'adankolo-felele');
  await backend.arm(session);
  await backend.write(session,{latitude:7.82,longitude:6.7,accuracy:8,lastGpsUpdate:Date.now(),speed:0,heading:null});
  assert.equal((await db.get(db.ref(database,'buses/FUL-001/status'))).val(),'ONLINE');
  await backend.heartbeat(session);
  await assert.rejects(backend.claim(crypto.randomUUID(),''),/active trip/);
  await assert.rejects(db.update(db.ref(database,'buses/FUL-002'),{status:'ONLINE'}));
  await backend.end(session);
  assert.equal((await db.get(db.ref(database,'buses/FUL-001/tripStarted'))).val(),false);
});
test('server disconnect cleanup actually marks the trip offline',async()=>{
  const session=crypto.randomUUID();
  await backend.claim(session,'');await backend.arm(session);
  await backend.write(session,{latitude:7.82,longitude:6.7,accuracy:8,lastGpsUpdate:Date.now()});
  db.goOffline(database);
  let record;
  for(let i=0;i<30;i++) {
    const response=await fetch('http://127.0.0.1:9000/buses/FUL-001.json?ns='+projectId);
    record=await response.json();
    if(record?.status==='OFFLINE')break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(record.status,'OFFLINE');assert.equal(record.tripStarted,false);
});
