defmodule AppWeb.PageController do
  use AppWeb, :controller

  def home(conn, _params) do
    conn
    |> assign(:page_title, "Home Page")
    |> assign_prop(:name, "Phoenix + Inertia.js + Svelte")
    |> render_inertia("Home")
  end
end
