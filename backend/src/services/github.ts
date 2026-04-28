import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  owner: { login: string };
};

export async function getGitHubToken({ supabase, user }: AuthContext): Promise<string> {
  const { data: connection } = await supabase
    .from("github_connections")
    .select("github_access_token")
    .eq("user_id", user.id)
    .single();

  if (!connection?.github_access_token) {
    throw new HttpError(404, "no_github_connection");
  }

  return connection.github_access_token as string;
}

export async function listRepos(context: AuthContext): Promise<GitHubRepo[]> {
  const token = await getGitHubToken(context);
  const response = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=50",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new HttpError(response.status, "github_repos_failed", JSON.stringify(data));
  }

  return data as GitHubRepo[];
}

export async function disconnectGitHub({ supabase, user }: AuthContext): Promise<void> {
  const { error } = await supabase.from("github_connections").delete().eq("user_id", user.id);
  if (error) {
    throw new HttpError(500, "github_disconnect_failed", error.message);
  }
}
