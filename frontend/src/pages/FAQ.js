import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './FAQ.css';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    { q: 'How do I register for an account?', a: 'Click on the "Register" button in the navigation bar, fill in your details including name, email, phone number, and password, then submit the form.' },
    { q: 'What is KYC verification?', a: 'KYC (Know Your Customer) verification is a process to verify your identity using your citizenship document. This is required to participate in auctions.' },
    { q: 'How do I pay the deposit?', a: 'Once you find a property you want to bid on, click "Pay Deposit" and follow the instructions to make payment via Khalti or eSewa.' },
    { q: 'Can I get a refund if I don\'t win?', a: 'Yes, deposits are refunded to participants who do not win the auction within 7-14 business days.' },
    { q: 'How do I participate in an auction?', a: 'After your deposit is approved, you can join the live auction room at the scheduled time and place your bids in real-time.' },
    { q: 'What happens if I win an auction?', a: 'If you win, you will be notified and required to complete the full payment within the specified timeframe to secure the property.' }
  ];

  return (
    <div>
      <Navigation />
      <div className="faq-page">
        <div className="faq-container">
          <div className="faq-header">
            <h1 className="faq-title">Frequently Asked Questions</h1>
            <p className="faq-subtitle">Find answers to common questions</p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, idx) => (
              <div key={idx} className="faq-item">
                <button className="faq-question" onClick={() => setOpenIndex(openIndex === idx ? null : idx)}>
                  <span>{faq.q}</span>
                  {openIndex === idx ? <FaChevronUp /> : <FaChevronDown />}
                </button>
                {openIndex === idx && <div className="faq-answer">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default FAQ;

