// Central route table. Functions return concrete URLs given an id;
// passing no argument returns the route pattern for <Route path>.

export const routes = {
  signIn: "/sign-in",
  dashboard: "/dashboard",
  newChart: "/charts/new",
  chart: (id = ":id") => `/charts/${id}`,
  giveStar: (id = ":id") => `/charts/${id}/give`,
  summon: (id = ":id") => `/charts/${id}/summon`,
  celebrate: (id = ":id") => `/charts/${id}/celebrate`,
  memory: (id = ":id") => `/charts/${id}/memory`,
} as const;
