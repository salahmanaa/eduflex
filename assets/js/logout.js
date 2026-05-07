document.addEventListener('DOMContentLoaded', () => {
  // Handle both sidebar and dropdown logout buttons
  document.querySelectorAll('[href="../index.html"], #logoutButton').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        const { isConfirmed } = await Swal.fire({
          title: 'Déconnexion',
          text: "Êtes-vous sûr de vouloir vous déconnecter ?",
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#3085d6',
          confirmButtonText: 'Oui, déconnecter',
          cancelButtonText: 'Annuler'
        });

        if (!isConfirmed) return;

        // Debug: Log before fetch
        console.log('Attempting logout...');
        
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // Debug: Log raw response
        console.log('Logout response:', response);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Logout failed');
        }

        const data = await response.json();
        
        // Debug: Log server response
        console.log('Logout success:', data);
        
        // Clear client-side data
        localStorage.clear();
        sessionStorage.clear();
        
        // Redirect with small delay
        setTimeout(() => {
          window.location.href = '../index.html';
        }, 500);
        
      } catch (error) {
        console.error('Logout error:', error);
        Swal.fire({
          title: 'Erreur',
          text: `Échec de la déconnexion: ${error.message}`,
          icon: 'error',
          willClose: () => {
            // Optional: Force redirect even on error
            // window.location.href = '../index.html';
          }
        });
      }
    });
  });
});