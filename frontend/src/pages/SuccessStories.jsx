import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { FiHeart } from 'react-icons/fi';
import Seo from '../components/common/Seo';

export default function SuccessStories() {
  const { t } = useTranslation();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/success-stories');
        setStories(res.data.stories || []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Seo
        title="Success Stories"
        description="Real couples who found their life partner on TricityShadi across Chandigarh, Mohali and Panchkula."
        path="/success-stories"
      />
      <div className="text-center mb-10">
        <h1 className="text-3xl font-semibold text-neutral-800">{t('successStories.title')}</h1>
        <p className="text-neutral-600 mt-2">{t('successStories.subtitle')}</p>
      </div>

      {loading ? (
        <p className="text-center text-neutral-600">{t('common.loading')}</p>
      ) : stories.length === 0 ? (
        <p className="text-center text-neutral-600">{t('successStories.empty')}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <article key={s.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
              {s.photoUrl && (
                <img src={s.photoUrl} alt={s.coupleNames} className="w-full h-48 object-cover" loading="lazy" />
              )}
              <div className="p-5">
                <FiHeart className="w-5 h-5 text-rose-500 mb-2" />
                <p className="text-neutral-700 italic mb-4">“{s.quote}”</p>
                <p className="font-semibold text-neutral-800">{s.coupleNames}</p>
                <p className="text-sm text-neutral-400">
                  {s.location}{s.marriedOn ? ` · ${t('successStories.married')} ${new Date(s.marriedOn).getFullYear()}` : ''}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
