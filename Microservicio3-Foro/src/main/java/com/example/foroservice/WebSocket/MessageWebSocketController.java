package com.example.foroservice.WebSocket;

import org.springframework.messaging.handler.annotation.*;
import org.springframework.stereotype.Controller;
import lombok.RequiredArgsConstructor;
import com.example.foroservice.Domain.Entities.Message;
import com.example.foroservice.Application.Services.MessageService;

@Controller
@RequiredArgsConstructor
public class MessageWebSocketController {

    private final MessageService messageService;

    // Prueba
    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(MessageWebSocketController.class);

    @MessageMapping("/chat/{threadId}")
    @SendTo("/topic/thread/{threadId}")
    public Message sendMessage(@Payload Message message,
                               @DestinationVariable String threadId) {
        log.info(">>> Mensaje recibido en threadId: {}", threadId);
        log.info(">>> Contenido: {}", message.getText());
        message.setThreadId(threadId);
        return messageService.create(message);
    }
}
