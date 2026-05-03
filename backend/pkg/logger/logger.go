package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func Init(environment string) {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix

	if environment == "development" {
		log.Logger = log.Output(
			zerolog.ConsoleWriter{
				Out:        os.Stdout,
				TimeFormat: time.RFC3339,
			},
		)
	}

	level := zerolog.InfoLevel
	if environment == "development" {
		level = zerolog.DebugLevel
	}
	zerolog.SetGlobalLevel(level)

	log.Info().
		Str("environment", environment).
		Msg("Logger initialized")
}
