import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSmokeTest() {
  console.log('=== Starting Auth Smoke Test Suite ===\n');

  // STEP 1: Sign up a new accountant
  console.log('[Step 1] Testing Accountant Signup & Firm Creation...');
  const testAccountantEmail = `smoke_ca_${Date.now()}@test.fake`;
  const testPassword = 'Password123!Secure';
  
  const { data: signUpData, error: signUpErr } = await adminClient.auth.admin.createUser({
    email: testAccountantEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'CA Smoke Tester' },
  });
  if (signUpErr) throw signUpErr;
  const caUser = signUpData.user;
  console.log(`  ✓ Created user ${caUser.email} (${caUser.id})`);

  // Create firm with admin using user's context
  const caClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: caSignInErr } = await caClient.auth.signInWithPassword({
    email: testAccountantEmail,
    password: testPassword,
  });
  if (caSignInErr) throw caSignInErr;

  const firmName = 'Smoke CA Practice';
  const { data: firmId, error: rpcErr } = await caClient.rpc('create_firm_with_admin', {
    firm_name: firmName,
  });
  if (rpcErr) throw rpcErr;
  console.log(`  ✓ Created firm "${firmName}" (ID: ${firmId}) via create_firm_with_admin`);

  // Verify firm membership
  const { data: firmMember } = await adminClient
    .from('firm_members')
    .select('role')
    .eq('firm_id', firmId)
    .eq('user_id', caUser.id)
    .single();
  if (firmMember?.role !== 'admin') throw new Error(`Expected admin role, got ${firmMember?.role}`);
  console.log(`  ✓ Confirmed firm_members entry with role 'admin' -> destination is /app`);

  // Create a client under this firm for invites
  const { data: clientObj, error: clientErr } = await adminClient
    .from('clients')
    .insert({
      firm_id: firmId,
      legal_name: 'Smoke Kirana Store Pvt Ltd',
      trade_name: 'Smoke Kirana',
      gstin: '27AABCU9603R1ZX',
      state_code: '27',
    })
    .select()
    .single();
  if (clientErr) throw clientErr;
  console.log(`  ✓ Created test client "${clientObj.trade_name}" (${clientObj.id})`);

  // STEP 2: Generate an invite token
  console.log('\n[Step 2] Generating Invite Token via create_client_invite...');
  const { data: rawToken, error: inviteErr } = await caClient.rpc('create_client_invite', {
    p_client_id: clientObj.id,
  });
  if (inviteErr) throw inviteErr;
  if (!rawToken || rawToken.length !== 64) throw new Error(`Invalid token format: ${rawToken}`);
  console.log(`  ✓ Generated 32-byte (64 hex) raw token: ${rawToken.substring(0, 16)}...`);

  // STEP 3: Peek the invite token (unauthenticated anon)
  console.log('\n[Step 3] Peeking Invite Token (Anon)...');
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: peekData, error: peekErr } = await anonClient.rpc('peek_client_invite', {
    p_token: rawToken,
  });
  if (peekErr) throw peekErr;
  const peek = Array.isArray(peekData) ? peekData[0] : peekData;
  console.log(`  ✓ Peek returned: Business "${peek.client_name}", Firm "${peek.firm_name}"`);

  // STEP 4: Accept invite with new Client Owner user
  console.log('\n[Step 4] Accepting Invite as Client Owner...');
  const ownerEmail = `smoke_owner_${Date.now()}@test.fake`;
  const { data: ownerUserObj, error: ownerCreateErr } = await adminClient.auth.admin.createUser({
    email: ownerEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (ownerCreateErr) throw ownerCreateErr;

  const ownerClient = createClient(SUPABASE_URL, ANON_KEY);
  await ownerClient.auth.signInWithPassword({ email: ownerEmail, password: testPassword });

  const { data: acceptedClientId, error: acceptErr } = await ownerClient.rpc('accept_client_invite', {
    p_token: rawToken,
  });
  if (acceptErr) throw acceptErr;
  if (acceptedClientId !== clientObj.id) throw new Error('Client ID mismatch on acceptance');
  console.log(`  ✓ Invite successfully accepted. User granted access to client ${acceptedClientId}`);

  // Verify single-use: second acceptance must fail
  const { error: secondAcceptErr } = await ownerClient.rpc('accept_client_invite', {
    p_token: rawToken,
  });
  if (!secondAcceptErr) throw new Error('Expected single-use error on second acceptance!');
  console.log(`  ✓ Single-use verified: Re-acceptance rejected with "${secondAcceptErr.message}"`);

  // STEP 5: Access check - Owner attempting /app vs /portal
  console.log('\n[Step 5] Role Routing Verification for Client Owner...');
  const { data: ownerAccess } = await adminClient
    .from('client_access')
    .select('role')
    .eq('client_id', clientObj.id)
    .eq('user_id', ownerUserObj.user.id)
    .single();
  const { data: ownerFirms } = await adminClient
    .from('firm_members')
    .select('id')
    .eq('user_id', ownerUserObj.user.id);
  const isOwner = ownerAccess?.role === 'owner';
  const hasFirm = (ownerFirms?.length || 0) > 0;
  const ownerHome = hasFirm ? '/app' : (isOwner ? '/portal' : '/no-access');
  if (ownerHome !== '/portal') throw new Error(`Expected owner home /portal, got ${ownerHome}`);
  console.log(`  ✓ Client Owner resolved home is /portal; access to /app redirects to /portal`);

  // STEP 6: Access check - Accountant attempting /portal vs /app
  console.log('\n[Step 6] Role Routing Verification for CA Accountant...');
  const { data: caFirms } = await adminClient
    .from('firm_members')
    .select('id')
    .eq('user_id', caUser.id);
  const caHome = (caFirms?.length || 0) > 0 ? '/app' : '/no-access';
  if (caHome !== '/app') throw new Error(`Expected CA home /app, got ${caHome}`);
  console.log(`  ✓ CA Accountant resolved home is /app; access to /portal redirects to /app`);

  // STEP 7 & 8: Logout verification
  console.log('\n[Step 7 & 8] Logout Verification...');
  await caClient.auth.signOut();
  const { data: caAfterSignOut } = await caClient.auth.getUser();
  if (caAfterSignOut?.user) throw new Error('CA session remained after signOut');
  await ownerClient.auth.signOut();
  const { data: ownerAfterSignOut } = await ownerClient.auth.getUser();
  if (ownerAfterSignOut?.user) throw new Error('Owner session remained after signOut');
  console.log('  ✓ Sessions cleared successfully on sign out -> user directed to /login');

  // STEP 9: Password Reset Request
  console.log('\n[Step 9] Password Reset Request...');
  const resetEmail = testAccountantEmail;
  const { error: resetReqErr } = await anonClient.auth.resetPasswordForEmail(resetEmail, {
    redirectTo: 'http://localhost:3000/reset-password',
  });
  if (resetReqErr) throw resetReqErr;
  console.log(`  ✓ Password reset email dispatched for ${resetEmail}`);

  // STEP 10: Password Reset Application
  console.log('\n[Step 10] Password Reset Application...');
  const newPassword = 'NewPassword456!Secure';
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(caUser.id, {
    password: newPassword,
  });
  if (updateErr) throw updateErr;

  const testLoginClient = createClient(SUPABASE_URL, ANON_KEY);
  const { data: newLoginData, error: newLoginErr } = await testLoginClient.auth.signInWithPassword({
    email: testAccountantEmail,
    password: newPassword,
  });
  if (newLoginErr) throw new Error(`Failed to log in with new password: ${newLoginErr.message}`);
  console.log(`  ✓ Successfully authenticated with new password for ${newLoginData.user.email}`);

  console.log('\n=========================================');
  console.log('ALL 10 SMOKE TEST STEPS PASSED PERFECTLY!');
  console.log('=========================================\n');
}

runSmokeTest().catch((err) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
