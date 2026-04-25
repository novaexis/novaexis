
import { 
  assertEquals, 
  assertNotEquals,
  assertExists 
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Configuration from environment
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// Use direct URL for Deno tests if needed, but local env should have it
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Missing Supabase environment variables (URL, SERVICE_ROLE, or ANON). Ensure they are set in the testing environment.");
}

// We use the admin client to setup test data
const adminClient = createClient(supabaseUrl, serviceRoleKey);

Deno.test("RLS: Cross-tenant isolation test", async (t) => {
  // 1. Setup two distinct tenants
  const tenantA_ID = crypto.randomUUID();
  const tenantB_ID = crypto.randomUUID();
  
  await t.step("Setup test tenants", async () => {
    await adminClient.from('tenants').insert([
      { id: tenantA_ID, nome: 'Tenant A', slug: 'tenant-a' },
      { id: tenantB_ID, nome: 'Tenant B', slug: 'tenant-b' }
    ]);
  });

  // 2. Setup two users, one for each tenant
  const userA_Email = `test_a_${Date.now()}@example.com`;
  const userB_Email = `test_b_${Date.now()}@example.com`;
  const password = "TestPassword123!";

  let userA_ID: string;
  let userB_ID: string;

  await t.step("Setup test users", async () => {
    const { data: authA } = await adminClient.auth.admin.createUser({
      email: userA_Email,
      password,
      email_confirm: true
    });
    const { data: authB } = await adminClient.auth.admin.createUser({
      email: userB_Email,
      password,
      email_confirm: true
    });

    userA_ID = authA.user!.id;
    userB_ID = authB.user!.id;

    // Assign tenants via profile and roles
    await adminClient.from('profiles').update({ tenant_id: tenantA_ID }).eq('id', userA_ID);
    await adminClient.from('profiles').update({ tenant_id: tenantB_ID }).eq('id', userB_ID);
    
    await adminClient.from('user_roles').insert([
      { user_id: userA_ID, role: 'cidadao', tenant_id: tenantA_ID },
      { user_id: userB_ID, role: 'cidadao', tenant_id: tenantB_ID }
    ]);
  });

  // 3. Test Isolation on 'demandas' table (example of RLS-enabled table)
  await t.step("Test tenant isolation on 'demandas' table", async () => {
    // Authenticate as User A
    const clientA = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    await clientA.auth.signInWithPassword({ email: userA_Email, password });

    // User A creates a demanda
    const { data: demandaA, error: errA } = await clientA
      .from('demandas')
      .insert({ 
        tenant_id: tenantA_ID, 
        cidadao_id: userA_ID, 
        titulo: 'Demanda A', 
        secretaria_slug: 'saude', 
        tipo: 'reclamacao',
        protocolo: `A-${Date.now()}`
      })
      .select()
      .single();
    
    assertEquals(errA, null, "User A should be able to create demanda in own tenant");

    // Authenticate as User B
    const clientB = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    await clientB.auth.signInWithPassword({ email: userB_Email, password });

    // User B tries to read Demanda A (should return nothing or error depending on policy)
    const { data: readAByB } = await clientB
      .from('demandas')
      .select('*')
      .eq('id', demandaA.id);
    
    assertEquals(readAByB?.length, 0, "User B should NOT be able to see User A's data");

    // User B tries to insert into Tenant A (should fail RLS)
    const { error: crossInsertErr } = await clientB
      .from('demandas')
      .insert({ 
        tenant_id: tenantA_ID, 
        cidadao_id: userB_ID, 
        titulo: 'Sneaky Insert', 
        secretaria_slug: 'saude', 
        tipo: 'solicitacao',
        protocolo: `Sneak-${Date.now()}`
      });
    
    assertNotEquals(crossInsertErr, null, "User B should NOT be able to insert into Tenant A");
  });

  // Cleanup
  await t.step("Cleanup", async () => {
    await adminClient.auth.admin.deleteUser(userA_ID);
    await adminClient.auth.admin.deleteUser(userB_ID);
    await adminClient.from('tenants').delete().in('id', [tenantA_ID, tenantB_ID]);
  });
});
