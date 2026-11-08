import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { saveUserProfile, UserProfile } from '@/services/user-profile';

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (profile: UserProfile, coords: { lat: number; lon: number } | null) => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Save user profile to local SQLite
      const profile = await saveUserProfile(name, phone);

      // Request location permission immediately
      let coords: { lat: number; lon: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = {
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
          };
        }
      } catch (locErr) {
        console.warn('Location permission error:', locErr);
      }

      onComplete(profile, coords);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <View style={styles.backdrop} />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          {/* Header & Logo */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                contentFit="contain"
              />
            </View>
            <Text style={styles.title}>Welcome to TransitDilli</Text>
            <Text style={styles.subtitle}>
              Real-time Delhi NCT Bus & Metro Radar with live GPS arrival countdowns
            </Text>
          </View>

          {/* Agency Badges: DTC Blue & Cluster Orange */}
          <View style={styles.agenciesRow}>
            <View style={[styles.agencyPill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <View style={[styles.agencyDot, { backgroundColor: '#1D4ED8' }]} />
              <Text style={[styles.agencyText, { color: '#1D4ED8' }]}>DTC Fleet (Blue)</Text>
            </View>
            <View style={[styles.agencyPill, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
              <View style={[styles.agencyDot, { backgroundColor: '#EA580C' }]} />
              <Text style={[styles.agencyText, { color: '#EA580C' }]}>Cluster Bus (Orange)</Text>
            </View>
          </View>

          {/* Input Fields */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Your Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Sahil Bajaj"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color="#64748B" style={styles.inputIcon} />
                <Text style={styles.countryCode}>+91</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="98765 43210"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Submit Action */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="navigate-circle" size={22} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Allow Location & Start Radar</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.privacyNote}>
              Location is used exclusively to show live buses and arrival timings near your stop.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  keyboardContainer: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  agenciesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  agencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  agencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  agencyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  form: {
    gap: 12,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 8,
  },
  countryCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: '#059669',
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  privacyNote: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
});
