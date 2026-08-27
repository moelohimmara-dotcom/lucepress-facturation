# Vérification visuelle — administration des campagnes IA

Les écrans `/agent-ia/planification`, `/agent-ia/audit` et `/agent-ia/e-mails-test` ont été vérifiés le 27 août 2026 sur un affichage bureau. Ils présentent respectivement l’état des programmations, les filtres du journal et la boîte e-mail interne de test, avec des états vides explicites lorsque la base ne contient pas encore de campagne ou de livraison.

Les trois vues expliquent clairement que les messages restent internes : ni e-mail personnel, ni Gmail, ni WhatsApp n’est contacté. La vérification automatisée couvre en complément le calendrier à six champs, le callback cron authentifié et les libellés de sécurité.
