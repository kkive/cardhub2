export default function access(initialState: {
  currentUser?: { id: string; email: string; username: string; role: string };
}) {
  const { currentUser } = initialState || {};
  return {
    canAdmin: currentUser?.role === 'admin',
    isLoggedIn: !!currentUser,
  };
}
