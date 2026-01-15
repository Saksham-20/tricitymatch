import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiHeart, FiUsers, FiBookmark, FiMessageCircle, FiEye, FiShield, FiCheckCircle, FiArrowRight, FiStar } from 'react-icons/fi';

const Home = () => {
  const [hoveredProfile, setHoveredProfile] = useState(null);

  // Mock featured profiles data
  const featuredProfiles = [
    { id: 1, name: 'Rahul Gupta', age: 31, location: 'Mumbai, Maharashtra', education: 'B.Tech from IIT Delhi', match: 97 },
    { id: 2, name: 'Priya Sharma', age: 28, location: 'Delhi, NCR', education: 'MBA from IIM Ahmedabad', match: 95 },
    { id: 3, name: 'Arjun Patel', age: 32, location: 'Bangalore, Karnataka', education: 'M.Tech from IIT Bombay', match: 93 },
    { id: 4, name: 'Anjali Nair', age: 29, location: 'Chennai, Tamil Nadu', education: 'B.Tech from NIT Trichy', match: 94 },
    { id: 5, name: 'Vikram Singh', age: 30, location: 'Pune, Maharashtra', education: 'CA from ICAI', match: 92 },
    { id: 6, name: 'Meera Reddy', age: 27, location: 'Hyderabad, Telangana', education: 'MBBS from AIIMS', match: 96 },
    { id: 7, name: 'Rohan Kapoor', age: 33, location: 'Chandigarh, Punjab', education: 'B.Tech from IIT Kanpur', match: 91 },
    { id: 8, name: 'Kavya Menon', age: 26, location: 'Kochi, Kerala', education: 'M.Sc from IISc Bangalore', match: 98 },
    { id: 9, name: 'Aman Verma', age: 31, location: 'Jaipur, Rajasthan', education: 'B.Tech from IIT Roorkee', match: 90 },
    { id: 10, name: 'Sneha Desai', age: 28, location: 'Ahmedabad, Gujarat', education: 'B.Tech from NIT Surat', match: 94 },
    { id: 11, name: 'Aditya Kumar', age: 29, location: 'Lucknow, Uttar Pradesh', education: 'MBA from XLRI', match: 93 },
    { id: 12, name: 'Divya Iyer', age: 27, location: 'Coimbatore, Tamil Nadu', education: 'B.Tech from PSG Tech', match: 95 },
    { id: 13, name: 'Rohit Malhotra', age: 32, location: 'Gurgaon, Haryana', education: 'B.Tech from IIT Delhi', match: 92 },
    { id: 14, name: 'Pooja Shah', age: 26, location: 'Surat, Gujarat', education: 'CA from ICAI', match: 96 },
    { id: 15, name: 'Karan Mehta', age: 30, location: 'Indore, Madhya Pradesh', education: 'B.Tech from IIT Indore', match: 91 },
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
    { icon: <FiShield />, title: 'Verified Profiles', desc: 'Identity verification ensures trust' },
    { icon: <FiHeart />, title: 'Smart Matching', desc: 'AI-powered compatibility algorithm' },
    { icon: <FiUsers />, title: 'Tricity Focus', desc: 'Connect with people from your region' },
    { icon: <FiCheckCircle />, title: 'Family Values', desc: 'Respectful, traditional approach' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAFAFA', paddingTop: '80px' }}>
      {/* Unique Split Hero Section */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        minHeight: '600px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Left Side - Text Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 60px',
          background: 'linear-gradient(135deg, #FAFAFA 0%, #FFF7E6 100%)',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(194, 24, 91, 0.08) 0%, transparent 70%)',
            zIndex: 1
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 3 }}>
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#fce4ec',
              borderRadius: '20px',
              marginBottom: '24px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#C2185B'
            }}>
              India's Trusted Matrimonial Platform
            </div>
            
            <h1 style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: '800',
              color: '#1F2937',
              marginBottom: '24px',
              lineHeight: '1.1',
              letterSpacing: '-0.02em'
            }}>
              From Trust to
              <span style={{ 
                display: 'block',
                background: 'linear-gradient(135deg, #C2185B 0%, #F59E0B 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>Love</span>
            </h1>
            
            <p style={{
              fontSize: '20px',
              color: '#6B7280',
              marginBottom: '40px',
              lineHeight: '1.6',
              maxWidth: '500px'
            }}>
              Mindful community, genuine connection. Find your life partner through verified, trusted profiles.
            </p>
            
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <Link
                to="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#C2185B',
                  color: 'white',
                  padding: '16px 32px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '16px',
                  textDecoration: 'none',
                  boxShadow: '0 10px 25px -5px rgba(194, 24, 91, 0.3)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 15px 35px -5px rgba(194, 24, 91, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 10px 25px -5px rgba(194, 24, 91, 0.3)';
                }}
              >
                Find Your Match
                <FiArrowRight style={{ width: '18px', height: '18px' }} />
              </Link>
              
            <Link
              to="/signup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'transparent',
                  color: '#C2185B',
                  padding: '16px 32px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '16px',
                  textDecoration: 'none',
                  border: '2px solid #C2185B',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#fce4ec';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Create Profile
            </Link>
            </div>
          </div>
        </div>

        {/* Right Side - Visual Element */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 60px',
          background: 'linear-gradient(135deg, #fce4ec 0%, #FFF7E6 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
            animation: 'pulse 3s ease-in-out infinite'
          }}></div>
          
          <div style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center'
          }}>
            <div style={{
              width: '300px',
              height: '300px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #C2185B 0%, #F59E0B 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 20px 60px -15px rgba(194, 24, 91, 0.4)',
              transform: 'rotate(-5deg)',
              transition: 'transform 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'rotate(0deg) scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'rotate(-5deg) scale(1)'}
            >
              <FiHeart style={{ width: '80px', height: '80px', marginBottom: '20px' }} />
              <div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '10px' }}>1,190+</div>
              <div style={{ fontSize: '18px', opacity: 0.9 }}>Successful Matches</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Unique Layout */}
      <section style={{
        padding: '100px 0',
        backgroundColor: '#FFFFFF',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 40px'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '60px'
          }}>
            <h2 style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 'bold',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
            Why Choose TricityMatch?
          </h2>
            <p style={{
              fontSize: '18px',
              color: '#6B7280',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Built with trust, designed for families, powered by technology
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '30px',
            marginTop: '60px'
          }}>
            {features.map((feature, index) => (
              <div
                key={index}
                style={{
                  padding: '40px 30px',
                  borderRadius: '20px',
                  background: index % 2 === 0 
                    ? 'linear-gradient(135deg, #FAFAFA 0%, #FFFFFF 100%)'
                    : 'linear-gradient(135deg, #FFF7E6 0%, #FAFAFA 100%)',
                  border: '2px solid transparent',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#C2185B';
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 20px 40px -10px rgba(194, 24, 91, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #C2185B 0%, #F59E0B 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '28px',
                  marginBottom: '24px'
                }}>
                  {feature.icon}
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#1F2937',
                  marginBottom: '12px'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  lineHeight: '1.6'
                }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Profiles - Asymmetric Grid */}
      <section style={{
        padding: '100px 0',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 40px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '60px'
          }}>
            <div>
              <h2 style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 'bold',
                color: '#1F2937',
                marginBottom: '16px'
              }}>
                Featured Profiles
              </h2>
              <p style={{
                fontSize: '18px',
                color: '#6B7280'
              }}>
                Discover verified members actively looking for their life partner
              </p>
            </div>
            <Link
              to="/search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#C2185B',
                fontWeight: '600',
                textDecoration: 'none',
                fontSize: '16px',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.gap = '12px';
              }}
              onMouseLeave={(e) => {
                e.target.style.gap = '8px';
              }}
            >
              View All
              <FiArrowRight style={{ width: '18px', height: '18px' }} />
            </Link>
          </div>

          {/* Playing Cards Scattered Layout */}
          <div style={{
            position: 'relative',
            width: '100%',
            minHeight: 'calc(100vh - 200px)',
            height: 'calc(100vh - 200px)',
            marginBottom: '60px',
            padding: '30px 50px'
          }}>
            {featuredProfiles.map((profile, index) => {
              // Spread cards across the entire viewport - using percentage-based positioning
              // Scattered positioning - cards spread to fill the entire screen
              const cardPositions = [
                { top: '5%', left: '3%', width: '200px', height: '280px', rotate: '-4deg', zIndex: 4 }, // Top left
                { top: '2%', left: '18%', width: '190px', height: '266px', rotate: '3deg', zIndex: 3 }, // Top left-center
                { top: '8%', left: '33%', width: '190px', height: '266px', rotate: '-2deg', zIndex: 2 }, // Top center-left
                { top: '4%', left: '48%', width: '190px', height: '266px', rotate: '2deg', zIndex: 1 }, // Top center
                { top: '6%', left: '63%', width: '190px', height: '266px', rotate: '-1.5deg', zIndex: 2 }, // Top center-right
                { top: '3%', left: '78%', width: '190px', height: '266px', rotate: '2.5deg', zIndex: 1 }, // Top right
                { top: '50%', left: '2%', width: '200px', height: '280px', rotate: '4deg', zIndex: 5 }, // Bottom left
                { top: '48%', left: '17%', width: '190px', height: '266px', rotate: '-3deg', zIndex: 3 }, // Bottom left-center
                { top: '52%', left: '32%', width: '190px', height: '266px', rotate: '1.5deg', zIndex: 2 }, // Bottom center-left
                { top: '50%', left: '47%', width: '190px', height: '266px', rotate: '2.5deg', zIndex: 2 }, // Center
                { top: '49%', left: '62%', width: '190px', height: '266px', rotate: '-1deg', zIndex: 1 }, // Bottom center-right
                { top: '51%', left: '77%', width: '190px', height: '266px', rotate: '1.8deg', zIndex: 1 }, // Bottom right
                { top: '25%', left: '10%', width: '190px', height: '266px', rotate: '-1.5deg', zIndex: 3 }, // Middle-left
                { top: '27%', left: '70%', width: '190px', height: '266px', rotate: '2deg', zIndex: 2 }, // Middle-right
                { top: '26%', left: '40%', width: '190px', height: '266px', rotate: '-2.5deg', zIndex: 3 }, // Middle-center
              ];
              
              const position = cardPositions[index] || cardPositions[index % cardPositions.length];
              const isLarge = index === 0 || index === 6; // First and seventh cards are larger
               
              return (
                <div
                  key={profile.id}
                  style={{
                    position: 'absolute',
                    top: position.top,
                    left: position.left,
                    width: position.width,
                    height: position.height,
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px', // Playing card corner radius
                    overflow: 'hidden',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #E5E7EB',
                    transition: 'all 0.3s ease-out',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    transform: `rotate(${position.rotate})`,
                    zIndex: position.zIndex
                  }}
                  onMouseEnter={() => setHoveredProfile(profile.id)}
                  onMouseLeave={() => setHoveredProfile(null)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#C2185B';
                    e.currentTarget.style.transform = `rotate(0deg) translateY(-15px) scale(1.08)`;
                    e.currentTarget.style.boxShadow = '0 20px 50px rgba(194, 24, 91, 0.3)';
                    e.currentTarget.style.zIndex = '10';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.transform = `rotate(${position.rotate})`;
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.15)';
                    e.currentTarget.style.zIndex = position.zIndex;
                  }}
                 >
                   {/* Image Section - Playing Card Style */}
                   <div style={{
                     flex: '0 0 auto',
                     height: isLarge ? '160px' : '140px',
                     background: 'linear-gradient(135deg, #f8bbd0 0%, #FFEECC 100%)',
                     position: 'relative',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     borderBottom: '1px solid #E5E7EB'
                   }}>
                     <FiUsers style={{
                       width: isLarge ? '70px' : '60px',
                       height: isLarge ? '70px' : '60px',
                       color: '#f06292',
                       opacity: hoveredProfile === profile.id ? 0.7 : 1,
                       transition: 'all 0.3s'
                     }} />
                     
                     {/* Match Badge */}
                     {profile.match >= 95 && (
                       <div style={{
                         position: 'absolute',
                         top: '10px',
                         left: '10px',
                         backgroundColor: '#16A34A',
                         color: 'white',
                         padding: '4px 10px',
                         borderRadius: '16px',
                         fontSize: '10px',
                         fontWeight: '600',
                         display: 'flex',
                         alignItems: 'center',
                         gap: '3px',
                         zIndex: 2
                       }}>
                         <FiStar style={{ width: '10px', height: '10px' }} />
                         {profile.match}% Match
                       </div>
                     )}
                     
                     {/* Action Icons */}
                     <div style={{
                       position: 'absolute',
                       top: '10px',
                       right: '10px',
                       display: 'flex',
                       gap: '6px',
                       zIndex: 2
                     }}>
                       <button 
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                         }}
                         style={{
                           width: '28px',
                           height: '28px',
                           backgroundColor: 'rgba(255, 255, 255, 0.95)',
                           borderRadius: '50%',
                           border: 'none',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           cursor: 'pointer',
                           boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                           transition: 'all 0.2s'
                         }}
                         onMouseEnter={(e) => {
                           e.target.style.transform = 'scale(1.1)';
                           e.target.style.backgroundColor = '#FFFFFF';
                         }}
                         onMouseLeave={(e) => {
                           e.target.style.transform = 'scale(1)';
                           e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                         }}
                       >
                         <FiBookmark style={{ width: '12px', height: '12px', color: '#6B7280' }} />
                       </button>
                       <button 
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                         }}
                         style={{
                           width: '28px',
                           height: '28px',
                           backgroundColor: 'rgba(255, 255, 255, 0.95)',
                           borderRadius: '50%',
                           border: 'none',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           cursor: 'pointer',
                           boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
                           transition: 'all 0.2s'
                         }}
                         onMouseEnter={(e) => {
                           e.target.style.transform = 'scale(1.1)';
                           e.target.style.backgroundColor = '#FFFFFF';
                         }}
                         onMouseLeave={(e) => {
                           e.target.style.transform = 'scale(1)';
                           e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                         }}
                       >
                         <FiHeart style={{ width: '12px', height: '12px', color: '#C2185B' }} />
                       </button>
                     </div>
                   </div>
                   
                   {/* Content Section - Playing Card Style */}
                   <div style={{
                     flex: '1 1 auto',
                     padding: isLarge ? '12px' : '10px',
                     display: 'flex',
                     flexDirection: 'column',
                     minHeight: 0,
                     backgroundColor: '#FFFFFF'
                   }}>
                     {/* Profile Info */}
                     <div style={{ 
                       flex: '1 1 auto',
                       marginBottom: '8px',
                       minHeight: 0
                     }}>
                       <h3 style={{
                         fontSize: isLarge ? '15px' : '14px',
                         fontWeight: '600',
                         color: '#1F2937',
                         marginBottom: '4px',
                         lineHeight: '1.3'
                       }}>
                         {profile.name}
                       </h3>
                       <p style={{
                         fontSize: '11px',
                         color: '#6B7280',
                         marginBottom: '3px',
                         lineHeight: '1.4'
                       }}>
                         {profile.age} years • {profile.location.split(',')[0]}
                       </p>
                       {isLarge && (
                         <p style={{
                           fontSize: '10px',
                           color: '#9CA3AF',
                           marginTop: '4px',
                           lineHeight: '1.4'
                         }}>
                           {profile.education}
                         </p>
                       )}
                     </div>
                     
                     {/* Action Buttons - Always at bottom */}
                     <div style={{ 
                       display: 'flex', 
                       gap: '5px',
                       marginTop: 'auto',
                       paddingTop: '8px',
                       borderTop: '1px solid #F3F4F6',
                       flexShrink: 0
                     }}>
                       <button 
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                         }}
                         style={{
                           flex: 1,
                           backgroundColor: '#F59E0B',
                           color: 'white',
                           padding: '6px 8px',
                           borderRadius: '5px',
                           fontWeight: '500',
                           fontSize: '11px',
                           border: 'none',
                           cursor: 'pointer',
                           transition: 'all 0.2s',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           height: '28px',
                           lineHeight: '1'
                         }}
                         onMouseEnter={(e) => {
                           e.target.style.backgroundColor = '#D6890A';
                           e.target.style.transform = 'translateY(-1px)';
                         }}
                         onMouseLeave={(e) => {
                           e.target.style.backgroundColor = '#F59E0B';
                           e.target.style.transform = 'translateY(0)';
                         }}
                       >
                         Message
                       </button>
                       <Link
                         to={`/profile/${profile.id}`}
                         onClick={(e) => e.stopPropagation()}
                         style={{
                           flex: 1,
                           backgroundColor: 'transparent',
                           border: '1.5px solid #E5E7EB',
                           color: '#C2185B',
                           padding: '6px 8px',
                           borderRadius: '5px',
                           fontWeight: '500',
                           fontSize: '11px',
                           textDecoration: 'none',
                           textAlign: 'center',
                           transition: 'all 0.2s',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           height: '28px',
                           lineHeight: '1'
                         }}
                         onMouseEnter={(e) => {
                           e.target.style.borderColor = '#C2185B';
                           e.target.style.backgroundColor = '#fce4ec';
                           e.target.style.transform = 'translateY(-1px)';
                         }}
                         onMouseLeave={(e) => {
                           e.target.style.borderColor = '#E5E7EB';
                           e.target.style.backgroundColor = 'transparent';
                           e.target.style.transform = 'translateY(0)';
                         }}
                       >
                         View
                       </Link>
                     </div>
                   </div>
                 </div>
               );
             })}
          </div>
        </div>
      </section>

      {/* Testimonials - Side by Side Layout */}
      <section style={{
        padding: '100px 0',
        backgroundColor: '#FFFFFF',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 40px'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '60px'
          }}>
            <h2 style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 'bold',
              color: '#1F2937',
              marginBottom: '16px'
            }}>
              Success Stories
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#6B7280'
            }}>
              Real couples, real stories, real happiness
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '40px'
          }}>
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: index === 1 ? '#FFF7E6' : '#FAFAFA',
                  borderRadius: '24px',
                  padding: '40px',
                  border: index === 1 ? '2px solid #F59E0B' : '2px solid transparent',
                  transition: 'all 0.3s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  fontSize: '60px',
                  marginBottom: '20px',
                  textAlign: 'center'
                }}>
                  {testimonial.image}
                </div>
                
                <p style={{
                  fontSize: '16px',
                  color: '#374151',
                  lineHeight: '1.7',
                  marginBottom: '24px',
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  "{testimonial.quote}"
                </p>
                
                <div style={{
                  textAlign: 'center',
                  paddingTop: '24px',
                  borderTop: '1px solid #E5E7EB'
                }}>
                  <h4 style={{
                    fontWeight: '600',
                    color: '#1F2937',
                    marginBottom: '4px'
                  }}>
                    {testimonial.names}
                  </h4>
                  <p style={{
                    fontSize: '14px',
                    color: '#9CA3AF'
                  }}>
                    {testimonial.location} • {testimonial.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Unique Split Design */}
      <section style={{
        padding: '120px 0',
        background: 'linear-gradient(135deg, #C2185B 0%, #F59E0B 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-200px',
          right: '-200px',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          filter: 'blur(80px)'
        }}></div>
        
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 40px',
          position: 'relative',
          zIndex: 2
        }}>
          <div style={{
            textAlign: 'center',
            color: 'white'
          }}>
            <h2 style={{
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 'bold',
              marginBottom: '24px',
              lineHeight: '1.2'
            }}>
              Ready to Begin Your Journey?
          </h2>
            <p style={{
              fontSize: '20px',
              marginBottom: '40px',
              opacity: 0.95,
              maxWidth: '600px',
              margin: '0 auto 40px'
            }}>
              Join thousands of families who found their perfect match through TricityMatch
            </p>
            
            <div style={{
              display: 'flex',
              gap: '20px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
          <Link
            to="/signup"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'white',
                  color: '#C2185B',
                  padding: '18px 40px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '18px',
                  textDecoration: 'none',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-4px)';
                  e.target.style.boxShadow = '0 15px 40px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.2)';
                }}
              >
                Create Your Profile
                <FiArrowRight style={{ width: '20px', height: '20px' }} />
              </Link>
              
              <Link
                to="/search"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'transparent',
                  color: 'white',
                  padding: '18px 40px',
                  borderRadius: '12px',
                  fontWeight: '600',
                  fontSize: '18px',
                  textDecoration: 'none',
                  border: '2px solid white',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Browse Profiles
          </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
