import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { getTestEnv } from './setup';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await getTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// Helper to set up users with custom claims
function consultantContext(env: RulesTestEnvironment, uid = 'consultant-1', isAdmin = false) {
  return env.authenticatedContext(uid, {
    role: 'consultant',
    isAdmin,
    email: 'consultant@cabinet.fr',
  });
}

function clientContext(env: RulesTestEnvironment, uid = 'client-1', clientId = 'clientA', email = 'owner@clientA.com') {
  return env.authenticatedContext(uid, {
    role: 'client',
    clientId,
    email,
  });
}

function unauthContext(env: RulesTestEnvironment) {
  return env.unauthenticatedContext();
}

// Seed helper — bypass rules to set up test data
async function seedClient(env: RulesTestEnvironment, id: string, ownerEmail: string, collaborators: string[] = []) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'clients', id), {
      companyName: `Client ${id}`,
      owner: { email: ownerEmail },
      status: 'active',
      collaboratorEmails: collaborators.map(e => e.toLowerCase()),
    });
  });
}

async function seedRecord(env: RulesTestEnvironment, recordId: string, clientId: string) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'records', recordId), {
      clientId,
      year: 2026,
      month: 'Janvier',
      revenue: { total: 100000 },
    });
  });
}

describe('Firestore rules — Multi-tenant access controls', () => {
  describe('clients collection', () => {
    it('consultant can read any client', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      const db = consultantContext(env).firestore();
      await assertSucceeds(getDoc(doc(db, 'clients', 'clientA')));
    });

    it('owner can read their own client doc', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertSucceeds(getDoc(doc(db, 'clients', 'clientA')));
    });

    it('client CANNOT read another client (cross-tenant leak prevention)', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      await seedClient(env, 'clientB', 'owner@b.com');
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertFails(getDoc(doc(db, 'clients', 'clientB')));
    });

    it('collaborator can read their company doc via collaboratorEmails', async () => {
      await seedClient(env, 'clientA', 'owner@a.com', ['collab@a.com']);
      const db = clientContext(env, 'u-collab', 'clientA', 'collab@a.com').firestore();
      await assertSucceeds(getDoc(doc(db, 'clients', 'clientA')));
    });

    it('unauthenticated user CANNOT read any client', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      const db = unauthContext(env).firestore();
      await assertFails(getDoc(doc(db, 'clients', 'clientA')));
    });

    it('only admin can delete a client', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      const consultantDb = consultantContext(env, 'c1', false).firestore();
      const adminDb = consultantContext(env, 'admin1', true).firestore();
      await assertFails(deleteDoc(doc(consultantDb, 'clients', 'clientA')));
      await assertSucceeds(deleteDoc(doc(adminDb, 'clients', 'clientA')));
    });
  });

  describe('records collection', () => {
    it('consultant can read any record', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      await seedRecord(env, 'rec-1', 'clientA');
      const db = consultantContext(env).firestore();
      await assertSucceeds(getDoc(doc(db, 'records', 'rec-1')));
    });

    it('client can read their own records', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      await seedRecord(env, 'rec-1', 'clientA');
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertSucceeds(getDoc(doc(db, 'records', 'rec-1')));
    });

    it("client CANNOT read another client's records (regression 557cbd6)", async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      await seedClient(env, 'clientB', 'owner@b.com');
      await seedRecord(env, 'rec-B', 'clientB');
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertFails(getDoc(doc(db, 'records', 'rec-B')));
    });

    it('client cannot create record with isValidated: true (cannot self-validate)', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertFails(setDoc(doc(db, 'records', 'rec-new'), {
        clientId: 'clientA',
        isValidated: true,
        isPublished: false,
        revenue: { total: 0 },
      }));
    });

    it('client cannot create record with isPublished: true', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertFails(setDoc(doc(db, 'records', 'rec-new'), {
        clientId: 'clientA',
        isValidated: false,
        isPublished: true,
        revenue: { total: 0 },
      }));
    });

    it('client can create a draft record (isValidated=false, isPublished=false)', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertSucceeds(setDoc(doc(db, 'records', 'rec-new'), {
        clientId: 'clientA',
        isValidated: false,
        isPublished: false,
        revenue: { total: 0 },
      }));
    });

    it('only consultant can delete records', async () => {
      await seedClient(env, 'clientA', 'owner@a.com');
      await seedRecord(env, 'rec-1', 'clientA');
      const clientDb = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      const consultantDb = consultantContext(env).firestore();
      await assertFails(deleteDoc(doc(clientDb, 'records', 'rec-1')));
      await assertSucceeds(deleteDoc(doc(consultantDb, 'records', 'rec-1')));
    });
  });

  describe('consultantAlerts collection (Wave 5)', () => {
    it('any authenticated user can create an alert', async () => {
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertSucceeds(setDoc(doc(db, 'consultantAlerts', 'alert-1'), {
        clientId: 'clientA',
        clientName: 'Client A',
        type: 'chat_handoff',
        message: 'help',
        resolved: false,
      }));
    });

    it('consultant can read alerts', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'consultantAlerts', 'alert-1'), {
          clientId: 'clientA', type: 'chat_handoff', resolved: false,
        });
      });
      const db = consultantContext(env).firestore();
      await assertSucceeds(getDoc(doc(db, 'consultantAlerts', 'alert-1')));
    });

    it('client CANNOT read alerts', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'consultantAlerts', 'alert-1'), {
          clientId: 'clientA', type: 'chat_handoff', resolved: false,
        });
      });
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertFails(getDoc(doc(db, 'consultantAlerts', 'alert-1')));
    });
  });

  describe('aiFeedback collection (Wave 5.5)', () => {
    it('any authenticated user can create feedback', async () => {
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertSucceeds(setDoc(doc(db, 'aiFeedback', 'fb-1'), {
        clientId: 'clientA',
        messageId: 'msg-1',
        rating: 'up',
      }));
    });

    it('client CANNOT read aiFeedback (telemetry is consultant-only)', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'aiFeedback', 'fb-1'), {
          clientId: 'clientA', rating: 'up',
        });
      });
      const db = clientContext(env, 'u-a', 'clientA', 'owner@a.com').firestore();
      await assertFails(getDoc(doc(db, 'aiFeedback', 'fb-1')));
    });

    it('nobody can update or delete aiFeedback (immutable)', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'aiFeedback', 'fb-1'), {
          clientId: 'clientA', rating: 'up',
        });
      });
      const consultantDb = consultantContext(env).firestore();
      const adminDb = consultantContext(env, 'admin1', true).firestore();
      await assertFails(updateDoc(doc(consultantDb, 'aiFeedback', 'fb-1'), { rating: 'down' }));
      await assertFails(deleteDoc(doc(adminDb, 'aiFeedback', 'fb-1')));
    });
  });
});
