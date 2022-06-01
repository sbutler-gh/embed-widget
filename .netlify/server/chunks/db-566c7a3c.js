import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://gwpngybarjdqtihhreyw.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDE3MTczMywiZXhwIjoxOTU1NzQ3NzMzfQ.HymWve9z0vTr1MUjlUYVHs18xSLp5252jCNgubkGYTc");
export { supabase as s };
