// FR5V6 Documentation - Interactive Behaviors

document.addEventListener('DOMContentLoaded', function() {
  // Smooth scroll for any anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Add active state to nav based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPage) {
      link.classList.add('active');
    }
  });

  // Reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) {
    document.documentElement.style.setProperty('--transition-duration', '0.01ms');
  }

  // Animate elements on scroll (if reduced motion is not preferred)
  if (!prefersReducedMotion.matches) {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll('.spec-card, .concept-section, .feature-item').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });

    // Add CSS for animation
    const style = document.createElement('style');
    style.textContent = `
      .in-view {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Spec table row hover feedback
  document.querySelectorAll('.specs-table tbody tr').forEach(row => {
    row.addEventListener('mouseenter', () => {
      row.style.backgroundColor = 'rgba(88, 166, 255, 0.05)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.backgroundColor = '';
    });
  });

  // Joint markers interaction (visual feedback on hover)
  document.querySelectorAll('.joint-marker').forEach(marker => {
    marker.addEventListener('mouseenter', () => {
      marker.style.backgroundColor = 'rgba(240, 136, 62, 0.2)';
      marker.style.transform = 'scale(1.1)';
      marker.style.transition = 'all 0.2s ease';
    });
    marker.addEventListener('mouseleave', () => {
      marker.style.backgroundColor = '';
      marker.style.transform = 'scale(1)';
    });
  });
});