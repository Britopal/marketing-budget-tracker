import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://jhzvjbcrhpistmwonaas.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_CFFp1pf1VEqsO-vBm7PtHA_clVe1hzz'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
