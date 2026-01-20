import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { FiSearch, FiHeart, FiUsers, FiBookmark, FiMessageCircle, FiShield, FiCheckCircle, FiArrowRight, FiStar, FiAward, FiUserCheck } from 'react-icons/fi';
import { staggerContainer, fadeInUp, scrollReveal, cardHover, scaleIn } from '../utils/animations';

const Home = () => {
  const [hoveredProfile, setHoveredProfile] = useState(null);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

  // Mock featured profiles data
  const featuredProfiles = [
    { id: 1, name: 'Rahul Gupta', age: 31, location: 'Mumbai, Maharashtra', education: 'B.Tech from IIT Delhi', match: 97 },
    { id: 2, name: 'Priya Sharma', age: 28, location: 'Delhi, NCR', education: 'MBA from IIM Ahmedabad', match: 95 },
    { id: 3, name: 'Arjun Patel', age: 32, location: 'Bangalore, Karnataka', education: 'M.Tech from IIT Bombay', match: 93 },
    { id: 4, name: 'Anjali Nair', age: 29, location: 'Chennai, Tamil Nadu', education: 'B.Tech from NIT Trichy', match: 94 },
    { id: 5, name: 'Vikram Singh', age: 30, location: 'Pune, Maharashtra', education: 'CA from ICAI', match: 92 },
    { id: 6, name: 'Meera Reddy', age: 27, location: 'Hyderabad, Telangana', education: 'MBBS from AIIMS', match: 96 },
  ];

  const testimonials = [
    {
      names: 'Priya & Arjun',
      location: 'Mumbai, Maharashtra',
      date: 'June 2024',
      quote: 'We found our perfect match through this wonderful platform. The journey from strangers to soulmates has been magical.',
      image: '👫'
    },
    {
      names: 'Anjali & Rohan',
      location: 'Delhi, NCR',
      date: 'August 2024',
      quote: 'TricityMatch made it so easy to connect with like-minded people. The verification process gave us confidence!',
      image: '💑'
    },
    {
      names: 'Meera & Vikram',
      location: 'Bangalore, Karnataka',
      date: 'September 2024',
      quote: 'From the first message to our engagement, everything felt right. Family values and compatibility made all the difference.',
      image: '💒'
    },
  ];

  const features = [
    { icon: <FiShield className="w-7 h-7" />, title: 'Verified Profiles', desc: 'Identity verification ensures trust and safety for all members' },
    { icon: <FiHeart className="w-7 h-7" />, title: 'Smart Matching', desc: 'AI-powered compatibility algorithm for better matches' },
    { icon: <FiUsers className="w-7 h-7" />, title: 'Tricity Focus', desc: 'Connect with people from Chandigarh, Mohali & Panchkula' },
    { icon: <FiCheckCircle className="w-7 h-7" />, title: 'Family Values', desc: 'Respectful, traditional approach to matrimony' },
  ];

  const stats = [
    { value: '1,190+', label: 'Successful Matches' },
    { value: '50,000+', label: 'Verified Profiles' },
    { value: '98%', label: 'Satisfaction Rate' },
    { value: '15+', label: 'Years Experience' },
  ];

  // Animation variants for scroll reveal
  const SectionWrapper = ({ children, className = "" }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-100px" });
    
    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={scrollReveal}
        className={className}
      >
        {children}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-primary-50/30 to-gold-50/40" />
        
        {/* Animated Background Elements */}
        <motion.div 
          className="absolute top-20 right-20 w-96 h-96 rounded-full bg-gradient-to-br from-primary-200/30 to-gold-200/30 blur-3xl"
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-gradient-to-br from-gold-200/30 to-primary-200/30 blur-3xl"
          animate={{ 
            scale: [1.1, 1, 1.1],
            opacity: [0.4, 0.6, 0.4]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left - Text Content */}
            <motion.div 
              className="text-center lg:text-left"
              initial="initial"
              animate="animate"
              variants={staggerContainer}
            >
              <motion.div 
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-100 rounded-full mb-6"
              >
                <FiAward className="w-4 h-4 text-primary-500" />
                <span className="text-sm font-semibold text-primary-600">India's Trusted Matrimony Platform</span>
              </motion.div>
              
              <motion.h1 
                variants={fadeInUp}
                className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-neutral-800 mb-6 leading-tight"
              >
                Where Trust Meets{' '}
                <span className="text-gradient-primary">Love</span>
              </motion.h1>
              
              <motion.p 
                variants={fadeInUp}
                className="text-lg md:text-xl text-neutral-600 mb-8 max-w-lg mx-auto lg:mx-0"
              >
                Find your perfect life partner through verified profiles and meaningful connections. 
                Join thousands of families who found happiness with TricityMatch.
              </motion.p>
              
              <motion.div 
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/search"
                    className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    Find Your Match
                    <FiArrowRight className="w-5 h-5" />
                  </Link>
                </motion.div>
                
                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/signup"
                    className="btn-secondary inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    Create Profile
                  </Link>
                </motion.div>
              </motion.div>

              {/* Trust Badges */}
              <motion.div 
                variants={fadeInUp}
                className="flex flex-wrap gap-4 mt-10 justify-center lg:justify-start"
              >
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <FiUserCheck className="w-5 h-5 text-success" />
                  <span>100% Verified</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <FiShield className="w-5 h-5 text-success" />
                  <span>Secure & Private</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <FiStar className="w-5 h-5 text-gold" />
                  <span>4.8/5 Rating</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right - Visual Element */}
            <motion.div 
              className="relative hidden lg:flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {/* Main Stats Card */}
              <motion.div
                className="relative z-10"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="w-80 h-80 rounded-3xl bg-gradient-hero flex flex-col items-center justify-center text-white shadow-2xl shadow-primary-500/30">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <FiHeart className="w-20 h-20 mb-6" />
                  </motion.div>
                  <span className="text-5xl font-bold mb-2">1,190+</span>
                  <span className="text-xl opacity-90">Successful Matches</span>
                </div>
              </motion.div>

              {/* Floating Cards */}
              <motion.div
                className="absolute -top-4 -left-8 bg-white rounded-2xl shadow-card p-4"
                animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success-light flex items-center justify-center">
                    <FiCheckCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800">Verified Profile</p>
                    <p className="text-xs text-neutral-500">Just joined</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -bottom-4 -right-8 bg-white rounded-2xl shadow-card p-4"
                animate={{ y: [0, 8, 0], rotate: [2, -2, 2] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold-50 flex items-center justify-center">
                    <FiStar className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800">New Match!</p>
                    <p className="text-xs text-neutral-500">98% Compatible</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-neutral-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <SectionWrapper key={index}>
                <motion.div 
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <p className="text-3xl md:text-4xl font-bold text-gradient-primary mb-2">{stat.value}</p>
                  <p className="text-neutral-600 text-sm md:text-base">{stat.label}</p>
                </motion.div>
              </SectionWrapper>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-white to-neutral-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <SectionWrapper className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-neutral-800 mb-4">
              Why Choose TricityMatch?
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Built with trust, designed for families, powered by technology
            </p>
          </SectionWrapper>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="group"
              >
                <div className="h-full p-8 rounded-2xl bg-white border border-neutral-100 shadow-card hover:shadow-card-hover hover:border-primary-100 transition-all duration-300">
                  <div className="w-14 h-14 rounded-xl bg-gradient-hero flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-800 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-neutral-600">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Profiles Section */}
      <section className="py-20 md:py-28 bg-neutral-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <SectionWrapper>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-neutral-800 mb-3">
                  Featured Profiles
                </h2>
                <p className="text-lg text-neutral-600">
                  Discover verified members actively looking for their life partner
                </p>
              </div>
              <motion.div whileHover={{ x: 5 }} className="mt-4 md:mt-0">
                <Link
                  to="/search"
                  className="inline-flex items-center gap-2 text-primary-500 font-semibold hover:text-primary-600 transition-colors"
                >
                  View All Profiles
                  <FiArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
            </div>
          </SectionWrapper>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featuredProfiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                viewport={{ once: true }}
                whileHover={{ y: -8 }}
                className="group"
              >
                <div className="bg-white rounded-2xl overflow-hidden border border-neutral-100 shadow-card hover:shadow-card-hover transition-all duration-300">
                  {/* Profile Image Placeholder */}
                  <div className="relative h-48 bg-gradient-to-br from-primary-100 via-gold-50 to-primary-50 flex items-center justify-center">
                    <FiUsers className="w-16 h-16 text-primary-300 group-hover:scale-110 transition-transform duration-300" />
                    
                    {/* Match Badge */}
                    {profile.match >= 95 && (
                      <motion.div 
                        className="absolute top-4 left-4 px-3 py-1.5 bg-success text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-md"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        <FiStar className="w-3 h-3" />
                        {profile.match}% Match
                      </motion.div>
                    )}

                    {/* Action Buttons */}
                    <div className="absolute top-4 right-4 flex gap-2">
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                      >
                        <FiBookmark className="w-4 h-4 text-neutral-600" />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-9 h-9 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                      >
                        <FiHeart className="w-4 h-4 text-primary-500" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Profile Info */}
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-neutral-800 mb-1">
                      {profile.name}
                    </h3>
                    <p className="text-sm text-neutral-600 mb-2">
                      {profile.age} years • {profile.location.split(',')[0]}
                    </p>
                    <p className="text-xs text-neutral-500 mb-4">
                      {profile.education}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 py-2.5 bg-gold text-white text-sm font-semibold rounded-xl hover:bg-gold-600 transition-colors"
                      >
                        Express Interest
                      </motion.button>
                      <Link
                        to={`/profile/${profile.id}`}
                        className="flex-1 py-2.5 border-2 border-neutral-200 text-primary-500 text-sm font-semibold rounded-xl text-center hover:border-primary-500 hover:bg-primary-50 transition-all"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 md:py-28 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <SectionWrapper className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-neutral-800 mb-4">
              Success Stories
            </h2>
            <p className="text-lg text-neutral-600">
              Real couples, real stories, real happiness
            </p>
          </SectionWrapper>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                viewport={{ once: true }}
                whileHover={{ y: -6 }}
                className={`p-8 rounded-3xl transition-all duration-300 ${
                  index === 1 
                    ? 'bg-gradient-to-br from-gold-50 to-primary-50 border-2 border-gold-200' 
                    : 'bg-neutral-50 border border-neutral-100'
                }`}
              >
                <div className="text-5xl mb-6 text-center">{testimonial.image}</div>
                <p className="text-neutral-700 italic text-center mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                <div className="text-center pt-6 border-t border-neutral-200">
                  <h4 className="font-semibold text-neutral-800">{testimonial.names}</h4>
                  <p className="text-sm text-neutral-500">{testimonial.location} • {testimonial.date}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 bg-gradient-hero relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <SectionWrapper className="text-center">
            <motion.h2 
              className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Ready to Begin Your Journey?
            </motion.h2>
            <motion.p 
              className="text-lg md:text-xl text-white/90 mb-10 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
            >
              Join thousands of families who found their perfect match through TricityMatch
            </motion.p>
            
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-primary-500 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  Create Your Profile
                  <FiArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
              
              <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/search"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-xl hover:bg-white/10 transition-all"
                >
                  Browse Profiles
                </Link>
              </motion.div>
            </motion.div>
          </SectionWrapper>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-neutral-900 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <span className="text-2xl font-display font-bold bg-gradient-to-r from-primary-400 to-gold-400 bg-clip-text text-transparent">
                TricityMatch
              </span>
              <p className="text-neutral-400 text-sm mt-2">India's Trusted Matrimony Platform</p>
            </div>
            <div className="flex items-center gap-6 text-sm text-neutral-400">
              <Link to="/about" className="hover:text-white transition-colors">About</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-neutral-500">
              © 2024 TricityMatch. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
