import { s as supabase } from "../../chunks/db-566c7a3c.js";
import "@supabase/supabase-js";
async function post({ request }) {
  const body = await await request.formData();
  console.log("submitting json");
  console.log(request);
  const { data, error } = await supabase.from("initiatives").insert([
    {
      lng: body.get("lng"),
      lat: body.get("lat"),
      lng_lat: body.get("lng_lat"),
      perspective: body.get("perspective")
    }
  ]);
  if (error) {
    return {
      status: error.status,
      body: error.message
    };
  } else {
    return {
      status: 200,
      body: data
    };
  }
}
export { post };
