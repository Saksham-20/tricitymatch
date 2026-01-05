import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiSearch, FiHeart, FiShield, FiUsers, FiCheckCircle, FiMail, FiUser, FiFileText, FiMessageCircle } from 'react-icons/fi';

const Home = () => {
  const navigate = useNavigate();
  const [searchForm, setSearchForm] = useState({
    lookingFor: '',
    maritalStatus: '',
    location: ''
  });

  const handleSearch = (e) => {
    e.preventDefault();
    navigate('/search', { state: searchForm });
  };

  const statistics = [
    { icon: <FiUsers className="w-8 h-8" />, number: '4,512', label: "Total groom & bride's biodatas" },
    { icon: <FiUser className="w-8 h-8" />, number: '1,881', label: "Total groom's biodatas" },
    { icon: <FiUser className="w-8 h-8" />, number: '2,629', label: "Total bride's biodatas" },
    { icon: <FiHeart className="w-8 h-8" />, number: '1,190+', label: "Total Successful Matches" },
  ];

  const howItWorks = [
    {
      step: 1,
      title: 'Create Biodata',
      description: 'You can easily create a biodata on TricityMatch completely free of cost within some steps.',
      icon: <FiFileText className="w-6 h-6" />
    },
    {
      step: 2,
      title: 'Search Biodata',
      description: 'You can easily search biodata using many filters including age, profession, educational qualification, and more.',
      icon: <FiSearch className="w-6 h-6" />
    },
    {
      step: 3,
      title: 'Contact with Guardians',
      description: 'If someone likes your biodata or you like someone\'s biodata, you can directly contact their parents.',
      icon: <FiMessageCircle className="w-6 h-6" />
    },
    {
      step: 4,
      title: 'Get Married',
      description: 'If you like the biodata and if you think conversation is well, do your own inquiry & get married according to your traditions.',
      icon: <FiHeart className="w-6 h-6" />
    },
  ];

  const keyFeatures = [
    'Easily can search biodata',
    'Can find biodata from specific area',
    'Filters for age, education & preferences',
    'Reasonable pricing package & refundable',
    'Quick support responses & contacts',
  ];

  return (
    <div className="min-h-screen bg-soft-peach">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-soft-peach via-soft-pink to-soft-blue py-16 md:py-24">
        {/* Decorative floral elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-primary-200 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-peach-300 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-soft-purple rounded-full opacity-30 blur-2xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Find a life partner of your choice
              </h1>
              <p className="text-lg md:text-xl text-gray-700 mb-8">
                We made it easy for you to get your life partner in your location
              </p>

              {/* Search Form */}
              <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-xl p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">I'm looking for</label>
                    <select
                      value={searchForm.lookingFor}
                      onChange={(e) => setSearchForm({ ...searchForm, lookingFor: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none text-gray-900"
                    >
                      <option value="">Select</option>
                      <option value="male">Male's Biodata</option>
                      <option value="female">Female's Biodata</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status</label>
                    <select
                      value={searchForm.maritalStatus}
                      onChange={(e) => setSearchForm({ ...searchForm, maritalStatus: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none text-gray-900"
                    >
                      <option value="">Select</option>
                      <option value="never-married">Never Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <select
                      value={searchForm.location}
                      onChange={(e) => setSearchForm({ ...searchForm, location: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none text-gray-900"
                    >
                      <option value="">Where are you looking for?</option>
                      <option value="chandigarh">Chandigarh</option>
                      <option value="mohali">Mohali</option>
                      <option value="panchkula">Panchkula</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full md:w-auto bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-full font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <FiSearch className="w-5 h-5" />
                  Search
                </button>
              </form>

              {/* Illustration Placeholder */}
              <div className="hidden lg:block mt-8">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md">
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary-200 to-peach-200 rounded-full flex items-center justify-center">
                      <FiUsers className="w-12 h-12 text-primary-600" />
                    </div>
                    <div className="w-24 h-24 bg-gradient-to-br from-peach-200 to-primary-200 rounded-full flex items-center justify-center">
                      <FiHeart className="w-12 h-12 text-peach-600" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Side - Profile Creation */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Creating a new profile</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                You can easily create a biodata on TricityMatch completely free of cost within some steps. You can easily search biodata using many filters including age, profession & educational qualifications.
              </p>
              <Link
                to="/signup"
                className="btn-primary inline-flex items-center gap-2"
              >
                Register Profile
              </Link>
              <div className="mt-6 bg-gradient-to-br from-primary-50 to-peach-50 rounded-xl p-6">
                <div className="flex items-center justify-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-primary-200 to-peach-200 rounded-full flex items-center justify-center">
                    <FiUser className="w-16 h-16 text-primary-600" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Religious Quote Section */}
      <section className="py-16 bg-gradient-to-br from-soft-peach via-soft-pink to-soft-blue">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 md:p-12"
          >
            <p className="text-lg md:text-xl text-gray-800 leading-relaxed italic">
              "Marriage is a sacred bond that brings two souls together. When you find the right partner, 
              you find a companion for life's journey. Trust in the process, have faith, and let love guide you."
            </p>
            <p className="text-sm text-gray-600 mt-4">- Traditional Wisdom</p>
          </motion.div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12"
          >
            TricityMatch's User Statistics
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statistics.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-gradient-to-br from-soft-peach to-soft-pink rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200"
              >
                <div className="text-primary-600 mb-4 flex justify-center">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold text-gray-900 text-center mb-2">{stat.number}</div>
                <div className="text-sm text-gray-700 text-center">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 bg-gradient-to-br from-soft-peach via-soft-pink to-soft-blue">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Key Features</h2>
              <p className="text-lg text-gray-700 mb-6">
                We made it easy for users to get a great experience about biodata.
              </p>
              <ul className="space-y-4">
                {keyFeatures.map((feature, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center mt-0.5">
                      <FiCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700 text-base">{feature}</span>
                  </motion.li>
                ))}
              </ul>
              <Link
                to="/about"
                className="btn-primary inline-flex items-center gap-2 mt-8"
              >
                Learn More
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl shadow-xl p-8"
            >
              <div className="bg-gradient-to-br from-primary-100 to-peach-100 rounded-xl p-12 flex items-center justify-center">
                <div className="w-48 h-48 bg-gradient-to-br from-primary-200 to-peach-200 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-primary-400 rounded-full animate-ping opacity-20"></div>
                  <FiShield className="w-24 h-24 text-primary-600" />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">How TricityMatch Works</h2>
            <p className="text-lg text-gray-600">A very easy 4 step process to find your partner.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-soft-peach to-soft-pink rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200 h-full">
                  <div className="flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full text-white text-2xl font-bold mb-4 mx-auto">
                    {step.step}
                  </div>
                  <div className="text-primary-600 mb-4 flex justify-center">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">{step.title}</h3>
                  <p className="text-gray-600 text-sm text-center leading-relaxed">{step.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <div className="w-8 h-0.5 bg-primary-300"></div>
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-8 border-l-primary-300 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-gradient-to-br from-soft-peach via-soft-pink to-soft-blue">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Our Newsletter</h2>
            <p className="text-lg text-gray-600 mb-8">
              Join our newsletter to get every update of our website and its privacy & policies.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-full focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none text-gray-900"
              />
              <button
                type="submit"
                className="btn-primary whitespace-nowrap"
              >
                <FiMail className="w-5 h-5 inline mr-2" />
                Subscribe
              </button>
            </form>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
