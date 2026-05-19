export async function getInitialState(): Promise<{
  currentUser?: { id: string; email: string; username: string; role: string };
}> {
  const token = localStorage.getItem('token');
  if (!token) return {};

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const user = await res.json();
      return { currentUser: user };
    }
    localStorage.removeItem('token');
    return {};
  } catch {
    return {};
  }
}
