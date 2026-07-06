import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

export default function Register() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: { name: string; email: string; password: string; org_name: string }) => {
    setLoading(true);
    try {
      await register(values.name, values.email, values.password, values.org_name);
      message.success(t('auth.orgCreated'));
      navigate('/');
    } catch (err: any) {
      message.error(err.message || t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { value: '< 1%', label: t('auth.statCpu') },
    { value: 'Zero', label: t('auth.statCodeChange') },
    { value: 'Full stack', label: t('auth.statFullStack') },
  ];

  return (
    <div className="auth-split">
      {/* Left: Brand */}
      <aside className="hidden lg:flex flex-col justify-between bg-bg-elevated text-fg-inverse p-14 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent-primary/30 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-8 h-8 rounded-lg bg-accent-primary" />
            <span className="text-xl font-semibold tracking-tight">{t('common.appName')}</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold tracking-tighter leading-none mb-6">
            {t('auth.registerHeroTitle')}
            <br />
            {t('auth.registerHeroTitleLine2')}
            <br />
            {t('auth.registerHeroTitleLine3')}
          </h1>

          <div className="space-y-4 mt-10 max-w-sm">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-start gap-4">
                <span className="text-2xl font-bold text-accent-primary font-mono tracking-tight leading-none">
                  {stat.value}
                </span>
                <span className="text-sm text-fg-tertiary leading-snug pt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-sm text-fg-secondary">
          {t('auth.registerHeroFooter')}
        </p>
      </aside>

      {/* Right: Form */}
      <main className="flex items-center justify-center px-8 py-12 bg-bg-elevated">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-7 h-7 rounded-lg bg-accent-primary" />
            <span className="text-lg font-semibold tracking-tight text-fg-primary">{t('common.appName')}</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-fg-primary mb-2">{t('auth.createYourOrg')}</h2>
            <p className="text-fg-tertiary">{t('auth.setupOrg')}</p>
          </div>

          <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
            <Form.Item
              name="org_name"
              label={<span className="text-sm font-medium text-fg-secondary">{t('auth.orgName')}</span>}
              rules={[{ required: true, message: t('auth.enterOrgName') }]}
            >
              <Input placeholder={t('auth.orgNamePlaceholder')} className="h-11" />
            </Form.Item>

            <Form.Item
              name="name"
              label={<span className="text-sm font-medium text-fg-secondary">{t('auth.yourName')}</span>}
              rules={[{ required: true, message: t('auth.enterName') }]}
            >
              <Input placeholder={t('auth.namePlaceholder')} className="h-11" />
            </Form.Item>

            <Form.Item
              name="email"
              label={<span className="text-sm font-medium text-fg-secondary">{t('auth.workEmail')}</span>}
              rules={[
                { required: true, message: t('auth.enterEmail') },
                { type: 'email', message: t('auth.validEmailRequired') },
              ]}
            >
              <Input placeholder={t('auth.emailPlaceholder')} autoComplete="email" className="h-11" />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="text-sm font-medium text-fg-secondary">{t('auth.password')}</span>}
              rules={[
                { required: true, message: t('auth.createPassword') },
                { min: 8, message: t('auth.minPasswordLength') },
              ]}
            >
              <Input.Password
                placeholder={t('auth.min8Chars')}
                autoComplete="new-password"
                className="h-11"
              />
            </Form.Item>

            <Form.Item className="mb-4">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="h-11 font-medium text-base"
              >
                {t('auth.signUp')}
              </Button>
            </Form.Item>
          </Form>

          <p className="text-center text-sm text-fg-tertiary">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-accent-primary font-medium hover:text-accent-primary transition-colors">
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
