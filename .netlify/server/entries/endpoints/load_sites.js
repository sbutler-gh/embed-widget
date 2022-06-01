import { s as supabase } from "../../chunks/db-566c7a3c.js";
import "@supabase/supabase-js";
const get = async () => {
  try {
    const { data: table, error } = await supabase.from("initiatives").select("*");
    return {
      body: JSON.stringify({ table, error })
    };
  } catch (e) {
    console.log({ e });
    return {
      body: JSON.stringify({ e })
    };
  }
};
export { get };
