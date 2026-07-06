// This page redirects to the unified agent/APM setup page
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function APMServiceSetup() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/agents/setup', { replace: true });
  }, [navigate]);
  return null;
}
